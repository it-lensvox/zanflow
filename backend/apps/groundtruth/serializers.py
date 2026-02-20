"""
Serializers for Ground Truth app.
"""
import os
from django.utils import timezone
from rest_framework import serializers

from apps.users.serializers import UserMinimalSerializer
from .models import Document, DocumentComment, GTVersion

def get_clean_unique_name(project_id, original_filename):
    """
    Checks if a file name exists in a project. 
    If yes, appends (1), (2), etc. until it finds a unique name.
    """
    # Split "api_10.ts" into "api_10" and ".ts"
    base_name, ext = os.path.splitext(original_filename)
    
    # 1. If the original name doesn't exist yet, just use it!
    if not Document.objects.filter(project_id=project_id, name=original_filename).exists():
        return original_filename
        
    # 2. If it DOES exist, start counting...
    count = 1
    while True:
        # Create the new name: "api_10 (1).ts"
        new_name = f"{base_name} ({count}){ext}"
        
        # Check if "api_10 (1).ts" exists
        if not Document.objects.filter(project_id=project_id, name=new_name).exists():
            return new_name # Found an empty slot!
            
        count += 1 # Try the next number
class GTVersionSerializer(serializers.ModelSerializer):
    """
    Serializer for GTVersion model.
    """
    created_by = UserMinimalSerializer(read_only=True)
    approved_by = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = GTVersion
        fields = [
            "id", "version_number", "gt_data", "change_summary",
            "changes_from_previous", "is_approved", "approved_at",
            "approved_by", "source_type", "source_reference",
            "created_by", "created_at",
        ]
        read_only_fields = [
            "id", "version_number", "is_approved", "approved_at",
            "approved_by", "created_by", "created_at",
        ]


class GTVersionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new GT versions.
    """
    class Meta:
        model = GTVersion
        fields = ["gt_data", "change_summary", "source_type", "source_reference"]
    
    def create(self, validated_data):
        document = self.context["document"]
        user = self.context["request"].user
        
        # Calculate changes from previous version
        previous_version = document.latest_version
        changes = {}
        if previous_version:
            old_keys = set(previous_version.gt_data.keys())
            new_keys = set(validated_data["gt_data"].keys())
            
            changes = {
                "added": list(new_keys - old_keys),
                "removed": list(old_keys - new_keys),
                "modified": [
                    k for k in old_keys & new_keys
                    if previous_version.gt_data.get(k) != validated_data["gt_data"].get(k)
                ],
            }
        
        version = GTVersion.objects.create(
            document=document,
            changes_from_previous=changes,
            created_by=user,
            **validated_data,
        )
        
        return version


class GTVersionListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for version list.
    """
    created_by = UserMinimalSerializer(read_only=True)
    fields_count = serializers.SerializerMethodField()
    
    class Meta:
        model = GTVersion
        fields = [
            "id", "version_number", "change_summary", "is_approved",
            "approved_at", "created_by", "created_at", "fields_count",
        ]
    
    def get_fields_count(self, obj):
        if isinstance(obj.gt_data, dict):
            return len(obj.gt_data)
        return 0


class DocumentCommentSerializer(serializers.ModelSerializer):
    """
    Serializer for DocumentComment.
    """
    created_by = UserMinimalSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    
    class Meta:
        model = DocumentComment
        fields = [
            "id", "content", "field_reference", "parent",
            "is_resolved", "created_by", "created_at", "replies",
        ]
        read_only_fields = ["id", "created_by", "created_at"]
    
    def get_replies(self, obj):
        if obj.replies.exists():
            return DocumentCommentSerializer(obj.replies.all(), many=True).data
        return []


class DocumentSerializer(serializers.ModelSerializer):
    created_by = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = Document
        fields = [
            "id", "project", "name", "description",
            "source_file", "source_file_url", "file_type", "file_size",
            "metadata", "status", "created_by", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "file_size", "created_by", "created_at", "updated_at"
        ]


class DocumentDetailSerializer(DocumentSerializer):
    """
    Detailed serializer with versions and comments.
    """
    versions = GTVersionListSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    
    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ["versions", "comments"]
    
    def get_comments(self, obj):
        # Get only top-level comments
        top_comments = obj.comments.filter(parent__isnull=True)
        return DocumentCommentSerializer(top_comments, many=True).data


class DocumentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "project", "name", "description", "source_file",
            "source_file_url", "file_type", "metadata",
        ]
    
    def create(self, validated_data):
        user = self.context["request"].user
        source_file = validated_data.get("source_file")
        project = validated_data.get("project")
        
        # --- NEW CLEAN NAME LOGIC ---
        # 1. Get the name from the request, or fallback to the actual uploaded filename
        original_name = validated_data.get("name")
        if not original_name and source_file:
            original_name = source_file.name
            
        # 2. Run it through our cleaner function
        if original_name and project:
            clean_name = get_clean_unique_name(project.id, original_name)
            validated_data["name"] = clean_name # Save the beautiful name to DB
        # ----------------------------

        if source_file:
            validated_data["file_size"] = source_file.size
        
        return Document.objects.create(created_by=user, **validated_data)


class DocumentBulkImportSerializer(serializers.Serializer):
    """
    Serializer for bulk document import.
    """
    documents = serializers.ListField(
        child=serializers.JSONField(),
        min_length=1,
    )
    # Expected format:
    # [{"name": "doc1", "gt_data": {...}, "metadata": {...}}, ...]


class VersionDiffSerializer(serializers.Serializer):
    """
    Serializer for version diff response.
    """
    version1 = GTVersionSerializer()
    version2 = GTVersionSerializer()
    diff = serializers.JSONField()
    # diff format:
    # {
    #     "added": {"field1": "new_value"},
    #     "removed": {"field2": "old_value"},
    #     "modified": {"field3": {"old": "x", "new": "y"}}
    # }
