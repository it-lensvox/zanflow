"""
Serializers for Projects app.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.users.serializers import UserMinimalSerializer

from .models import Label, Project, ProjectMembership
from apps.quicknotes.serializers import NoteSerializer
User = get_user_model()


class LabelSerializer(serializers.ModelSerializer):
    """
    Serializer for Label model.
    """
    class Meta:
        model = Label
        fields = ["id", "name", "color", "description", "is_default", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProjectMembershipSerializer(serializers.ModelSerializer):
    """
    Serializer for ProjectMembership.
    """
    user = UserMinimalSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
        write_only=True,
    )
    
    class Meta:
        model = ProjectMembership
        fields = ["id", "user", "user_id", "role", "joined_at"]
        read_only_fields = ["id", "joined_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Scope user_id dropdown to the current user's organization
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            org_id = getattr(request.user, "organization_id", None)
            if org_id:
                self.fields["user_id"].queryset = User.objects.filter(
                    organization_id=org_id, is_active=True
                )


class ProjectSerializer(serializers.ModelSerializer):
    """
    Serializer for Project model.
    """
    is_favourite = serializers.SerializerMethodField()
    created_by = UserMinimalSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    members = ProjectMembershipSerializer(
        source="projectmembership_set", 
        many=True, 
        read_only=True
    )
    member_count = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = [
            "id", "name", "description", "task_type",
            "project_settings", "default_labels", 
            "status", "is_favourite",  # Replaced is_active with status
            "created_by", "created_at", "updated_at",
            "labels","members","member_count", "document_count",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_document_count(self, obj):
        from apps.groundtruth.models import Document
        from django.db.models import Q
        return Document.objects.filter(
            Q(project=obj) | Q(shares__shared_project=obj)
        ).distinct().count()
    
    def get_is_favourite(self, obj):
        request = self.context.get('request')
        # Check if request AND request.user exist before accessing them
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return obj.favorited_by.filter(id=request.user.id).exists()
        return False
    def update(self, instance, validated_data):
        # Check if 'is_favourite' was passed in the request body
        request = self.context.get('request')
        if request and "is_favourite" in request.data:
            is_fav = request.data.get("is_favourite")
            user = request.user
            
            if is_fav:
                instance.favorited_by.add(user)
            else:
                instance.favorited_by.remove(user)
        
        return super().update(instance, validated_data)


class ProjectDetailSerializer(ProjectSerializer):
    """
    Detailed serializer for Project with members.
    """
    members = serializers.SerializerMethodField()
    default_assignees = UserMinimalSerializer(many=True, read_only=True)
    
    # ADD THIS: Field to hold the attached quick notes
    quick_notes = serializers.SerializerMethodField() 
    
    class Meta(ProjectSerializer.Meta):
        # ADD 'quick_notes' to the fields list
        fields = ProjectSerializer.Meta.fields + ["members", "default_assignees", "quick_notes"]
    
    def get_members(self, obj):
        memberships = ProjectMembership.objects.filter(project=obj).select_related("user")
        return ProjectMembershipSerializer(memberships, many=True).data
        
    # ADD THIS: Method to retrieve the notes
    def get_quick_notes(self, obj):
        # This relies on the 'related_name' we set in the Note model below
        notes = obj.project_notes.all().order_by('-updated_at')
        return NoteSerializer(notes, many=True).data
    
class MemberAssignmentSerializer(serializers.Serializer):
    """Helper serializer for inputting user + role pairs"""
    user_id = serializers.IntegerField()
    role = serializers.ChoiceField(choices=ProjectMembership.Role.choices)

class ProjectCreateSerializer(serializers.ModelSerializer):
    # This field handles the INPUT from Postman
    assigned_members = MemberAssignmentSerializer(many=True, required=False, write_only=True)
    
    # This field shows the RESULT in the response
    members = ProjectMembershipSerializer(
        source="projectmembership_set", 
        many=True, 
        read_only=True
    )

    class Meta:
        model = Project
        fields = [
            "id", "name", "description", "task_type",
            "project_settings", "default_labels", "assigned_members", "members",
            "status" # Added status here as well
        ]
        read_only_fields = ["id", "members"]

    def create(self, validated_data):
        assigned_members_data = validated_data.pop("assigned_members", [])
        project = Project.objects.create(**validated_data)
        
        # Add the Creator as OWNER
        user = self.context["request"].user
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": ProjectMembership.Role.OWNER}
        )
        
        # Add the dynamic roles — only allow users from the same organization
        org_id = getattr(user, "organization_id", None)
        for member_data in assigned_members_data:
            if member_data['user_id'] != user.id:
                # Verify user belongs to same org
                if org_id:
                    member_exists = User.objects.filter(
                        id=member_data['user_id'],
                        organization_id=org_id
                    ).exists()
                    if not member_exists:
                        continue  # Skip users from other orgs
                ProjectMembership.objects.create(
                    project=project,
                    user_id=member_data['user_id'],
                    role=member_data['role']
                )
        
        return project


class ProjectStatsSerializer(serializers.Serializer):
    """
    Serializer for project statistics.
    """
    total_documents = serializers.IntegerField()
    approved_documents = serializers.IntegerField()
    pending_documents = serializers.IntegerField()
    total_test_runs = serializers.IntegerField()
    latest_accuracy = serializers.FloatField(allow_null=True)
    open_issues = serializers.IntegerField()