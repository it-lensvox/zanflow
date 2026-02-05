"""
Serializers for the teams app.
Handles serialization/deserialization of Team and TeamMember models.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Team, TeamMember, TeamRole, TeamType, TeamColor

User = get_user_model()


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user representation for team member listings."""
    
    full_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "initials"]
        read_only_fields = fields
    
    def get_full_name(self, obj):
        """Get user's full name or email as fallback."""
        if hasattr(obj, "first_name") and hasattr(obj, "last_name"):
            full_name = f"{obj.first_name} {obj.last_name}".strip()
            if full_name:
                return full_name
        if hasattr(obj, "name") and obj.name:
            return obj.name
        return obj.email.split("@")[0]
    
    def get_initials(self, obj):
        """Get user's initials for avatar display."""
        full_name = self.get_full_name(obj)
        parts = full_name.split()
        if len(parts) >= 2:
            return f"{parts[0][0]}{parts[1][0]}".upper()
        return full_name[:2].upper()


class TeamMemberSerializer(serializers.ModelSerializer):
    """Serializer for team member details."""
    
    user = UserMinimalSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    can_manage = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = TeamMember
        fields = [
            "id",
            "user",
            "user_id",
            "role",
            "role_display",
            "can_manage",
            "joined_at",
            "created_at",
        ]
        read_only_fields = ["id", "joined_at", "created_at"]
    
    def validate_user_id(self, value):
        """Validate that the user exists."""
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")
        return value


class TeamMemberCreateSerializer(serializers.Serializer):
    """Serializer for adding a member to a team."""
    
    user_id = serializers.IntegerField()
    role = serializers.ChoiceField(
        choices=TeamRole.choices,
        default=TeamRole.MEMBER
    )
    
    def validate_user_id(self, value):
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")
        return value


class TeamMemberBulkCreateSerializer(serializers.Serializer):
    """Serializer for adding multiple members to a team."""
    
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    role = serializers.ChoiceField(
        choices=TeamRole.choices,
        default=TeamRole.MEMBER
    )
    
    def validate_user_ids(self, value):
        """Validate all user IDs exist."""
        existing_ids = set(
            uid for uid in User.objects.filter(
                id__in=value
            ).values_list("id", flat=True)
        )
        invalid_ids = [uid for uid in value if uid not in existing_ids]
        if invalid_ids:
            raise serializers.ValidationError(
                f"Users not found: {', '.join(map(str, invalid_ids))}"
            )
        return value


class TeamMemberUpdateSerializer(serializers.Serializer):
    """Serializer for updating a team member's role."""
    
    role = serializers.ChoiceField(choices=TeamRole.choices)


class TeamListSerializer(serializers.ModelSerializer):
    """Serializer for team list view (minimal data)."""
    
    member_count = serializers.SerializerMethodField()
    is_favourite = serializers.SerializerMethodField()
    team_type_display = serializers.CharField(
        source="get_team_type_display",
        read_only=True
    )
    leader_info = UserMinimalSerializer(source="leader", read_only=True)
    my_role = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "team_type",
            "team_type_display",
            "color",
            "description",
            "leader_info",
            "member_count",
            "my_role",
            "created_at",
            "is_favourite",
        ]
        read_only_fields = fields
    def get_is_favourite(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.favorited_by.filter(id=request.user.id).exists()
        return False
    
    def get_member_count(self, obj):
        """Get the count of active team members."""
        return obj.member_count
    
    def get_my_role(self, obj):
        """Get current user's role in the team."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.get_user_role(request.user)
        return None


class TeamDetailSerializer(serializers.ModelSerializer):
    """Serializer for detailed team view including members."""
    
    member_count = serializers.SerializerMethodField()
    # 1. Add the field here
    is_favourite = serializers.SerializerMethodField() 
    can_delete = serializers.SerializerMethodField()
    team_type_display = serializers.CharField(
        source="get_team_type_display",
        read_only=True
    )
    leader_info = UserMinimalSerializer(source="leader", read_only=True)
    members = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "team_type",
            "team_type_display",
            "color",
            "description",
            "leader",
            "leader_info",
            "member_count",
            "members",
            "my_role",
            "can_manage",
            "is_favourite",  # 2. Add it to the fields list
            "created_at",
            "updated_at",
            "can_delete",
        ]
        read_only_fields = [
            "id",
            "member_count",
            "members",
            "my_role",
            "can_manage",
            "is_favourite", # 3. Make it read-only
            "created_at",
            "updated_at",
        ]
    
    # 4. Add the logic method
    def get_is_favourite(self, obj):
        """Check if the current user has favorited this team."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            # Check if current user ID is in the favorited_by ManyToMany relationship
            return obj.favorited_by.filter(id=request.user.id).exists()
        return False
    def get_member_count(self, obj):
        """Get the count of active team members."""
        return obj.member_count
    def get_can_delete(self, obj):
        """Check if the current user is the leader and can delete."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.leader == request.user
        return False
    def get_members(self, obj):
        """Get all active team members."""
        members = obj.members.filter(deleted_at__isnull=True).select_related("user")
        return TeamMemberSerializer(members, many=True).data
    
    def get_my_role(self, obj):
        """Get current user's role in the team."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.get_user_role(request.user)
        return None
    
    def get_can_manage(self, obj):
        """Check if current user can manage the team."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.can_user_manage(request.user)
        return False


class TeamCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new team.
    Matches the UI: name, team_type, description, leader, members
    """
    
    leader_id = serializers.IntegerField(required=False, allow_null=True)
    member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list
    )
    color = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = Team
        fields = [
            "name",
            "team_type",
            "color",
            "description",
            "leader_id",
            "member_ids",
        ]
    
    def validate_name(self, value):
        """Validate team name."""
        if not value or not value.strip():
            raise serializers.ValidationError("Team name is required")
        return value.strip()
    
    def validate_team_type(self, value):
        """Validate team type is a valid choice."""
        if value not in dict(TeamType.choices):
            raise serializers.ValidationError(
                f"Invalid team type. Choices are: {list(dict(TeamType.choices).keys())}"
            )
        return value
    
    def validate_leader_id(self, value):
        """Validate leader exists."""
        if value:
            try:
                User.objects.get(id=value)
            except User.DoesNotExist:
                raise serializers.ValidationError("Leader not found")
        return value
    
    def validate_member_ids(self, value):
        """Validate all member IDs exist."""
        if value:
            existing_ids = set(
                uid for uid in User.objects.filter(
                    id__in=value
                ).values_list("id", flat=True)
            )
            invalid_ids = [uid for uid in value if uid not in existing_ids]
            if invalid_ids:
                raise serializers.ValidationError(
                    f"Users not found: {', '.join(map(str, invalid_ids))}"
                )
        return value
    
    def create(self, validated_data):
        """Create team using the service."""
        from .services import TeamService
        
        # Extract member_ids and leader_id before creating
        member_ids = validated_data.pop("member_ids", [])
        leader_id = validated_data.pop("leader_id", None)
        color = validated_data.pop("color", None) or TeamColor.BLUE
        
        # Get the current user as creator
        request = self.context.get("request")
        creator = request.user
        
        return TeamService.create_team(
            name=validated_data["name"],
            creator=creator,
            team_type=validated_data.get("team_type", TeamType.DEVELOPMENT),
            color=color,
            description=validated_data.get("description", ""),
            leader_id=leader_id,
            member_ids=member_ids
        )


class TeamUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating an existing team."""
    
    leader_id = serializers.IntegerField(required=False, allow_null=True)
    
    class Meta:
        model = Team
        fields = [
            "name",
            "team_type",
            "color",
            "description",
            "leader_id",
        ]
    
    def validate_name(self, value):
        if value is not None and not value.strip():
            raise serializers.ValidationError("Team name cannot be empty")
        return value.strip() if value else value
    
    def validate_leader_id(self, value):
        if value:
            try:
                User.objects.get(id=value)
            except User.DoesNotExist:
                raise serializers.ValidationError("Leader not found")
        return value
    
    def update(self, instance, validated_data):
        """Update team using the service."""
        from .services import TeamService
        
        request = self.context.get("request")
        
        return TeamService.update_team(
            team=instance,
            updated_by=request.user,
            **validated_data
        )


# Serializers for dropdown choices
class TeamTypeChoicesSerializer(serializers.Serializer):
    """Serializer for team type choices."""
    
    value = serializers.CharField()
    label = serializers.CharField()


class TeamColorChoicesSerializer(serializers.Serializer):
    """Serializer for team color choices."""
    
    value = serializers.CharField()
    label = serializers.CharField()


class TeamRoleChoicesSerializer(serializers.Serializer):
    """Serializer for team role choices."""
    
    value = serializers.CharField()
    label = serializers.CharField()