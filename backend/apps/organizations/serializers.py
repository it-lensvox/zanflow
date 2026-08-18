from rest_framework import serializers
from django.core.cache import cache
from .models import Organization, Workspace, WorkspaceMembership


# ---------------------------------------------------------------------------
# Organization Serializers (existing)
# ---------------------------------------------------------------------------

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name", "slug", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "slug", "created_at", "updated_at")


class TenantSignupSerializer(serializers.Serializer):
    company_name = serializers.CharField(
        max_length=255,
        help_text="Name of the organization/company",
    )
    admin_email = serializers.EmailField(
        help_text="Email for the admin account (used for login)",
    )
    password = serializers.CharField(
        write_only=True,
        help_text="Password",
    )
    password_confirm = serializers.CharField(
        write_only=True,
        help_text="Confirm password",
    )
    otp = serializers.CharField(
        write_only=True,
        help_text="6-digit OTP sent to the email",
    )

    def validate_company_name(self, value):
        if Organization.objects.filter(name__iexact=value.strip()).exists():
            raise serializers.ValidationError("An organization with this name already exists.")
        return value.strip()

    def validate_admin_email(self, value):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate(self, data):
        # 1. Password Match Validation
        if data.get("password") != data.get("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        # 2. OTP Validation
        email = data.get("admin_email")
        provided_otp = data.get("otp")
        
        if email and provided_otp:
            cache_key = f"signup_otp_{email}"
            cached_otp = cache.get(cache_key)

            if not cached_otp:
                raise serializers.ValidationError({"otp": "OTP has expired or was not requested."})
            
            if str(cached_otp) != str(provided_otp):
                raise serializers.ValidationError({"otp": "Invalid OTP."})

        return data


# ---------------------------------------------------------------------------
# Workspace Serializers (new)
# ---------------------------------------------------------------------------

class WorkspaceSerializer(serializers.ModelSerializer):
    """Read serializer for workspace details."""
    member_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = (
            "id", "name", "slug", "description",
            "is_default", "is_active",
            "member_count", "my_role",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "slug", "is_default",
            "created_at", "updated_at",
        )

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_my_role(self, obj):
        """Return the current user's role in this workspace."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(user=request.user).first()
            return membership.role if membership else None
        return None


class WorkspaceCreateSerializer(serializers.Serializer):
    """Serializer for creating a new workspace."""
    name = serializers.CharField(
        max_length=255,
        help_text="Name of the workspace",
    )
    description = serializers.CharField(
        required=False,
        default="",
        help_text="Optional description for the workspace",
    )

    def validate_name(self, value):
        """Check that workspace name is unique within the organization."""
        request = self.context.get("request")
        if request:
            org = request.user.organization
            if Workspace.objects.filter(
                organization=org, name__iexact=value.strip()
            ).exists():
                raise serializers.ValidationError(
                    "A workspace with this name already exists in your organization."
                )
        return value.strip()


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """Read serializer for workspace membership details."""
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = ("id", "user_id", "username", "email", "role", "joined_at")
        read_only_fields = ("id", "user_id", "username", "email", "joined_at")


class WorkspaceAddMemberSerializer(serializers.Serializer):
    """Serializer for adding a member to a workspace."""
    user_id = serializers.IntegerField(help_text="ID of the user to add")
    role = serializers.ChoiceField(
        choices=WorkspaceMembership.ROLE_CHOICES,
        default="member",
        help_text="Role of the user in this workspace",
    )

    def validate_user_id(self, value):
        """Check the user exists and belongs to the same organization."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        request = self.context.get("request")

        try:
            user = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

        if request and user.organization_id != request.user.organization_id:
            raise serializers.ValidationError(
                "User does not belong to your organization."
            )

        return value
