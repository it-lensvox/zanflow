from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import Invitation, ContactMessage
User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model with simple skills list.
    """
    skills = serializers.JSONField(required=False)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "avatar", "skills", "is_active", "date_joined", "is_superuser",
            "auth_provider",
        ]
        read_only_fields = ["id", "date_joined", "is_superuser", "auth_provider"]

    def validate_skills(self, value):
        """
        Validates skills and converts them to a simple list of strings.
        Accepts: ["Python", "Django"] OR [{"name": "Python"}, ...]
        """
        if not isinstance(value, list):
            raise serializers.ValidationError("Skills must be a list.")

        cleaned_skills = []

        for item in value:
            # Case 1: Item is a simple string (e.g., "Python")
            if isinstance(item, str):
                cleaned_skills.append(item.strip())
            
            # Case 2: Item is an object (e.g., {"name": "Python", "proficiency": "..."})
            # We extract just the name and ignore the rest
            elif isinstance(item, dict):
                name = item.get("name")
                if name and isinstance(name, str):
                    cleaned_skills.append(name.strip())
        
        # Remove duplicates and return
        return list(set(cleaned_skills))
class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating users.
    """
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            "username", "email", "password", "password_confirm",
            "first_name", "last_name", "role",
        ]
    
    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match"})
        return data
    
    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

class UserRoleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['role']
        
    def validate_role(self, value):
        if value not in User.Role.values:
             raise serializers.ValidationError("Invalid role selected.")
        return value
    
class UserMinimalSerializer(serializers.ModelSerializer):
    """
    Minimal serializer for user references.
    """
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ["id", "username", "full_name", "avatar"]
    
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username
    
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=4)

class SetNewPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    reset_token = serializers.CharField() # Use reset_token instead of otp
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        # Match passwords
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return data

class AuthenticatedResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_new_password = serializers.CharField(write_only=True)

    def validate(self, data):
        # 1. Ensure new password and confirm password match
        if data["new_password"] != data["confirm_new_password"]:
            raise serializers.ValidationError({"confirm_new_password": "New passwords do not match."})
        
        # 2. Ensure new password is not the same as the old password
        if data["new_password"] == data["old_password"]:
            raise serializers.ValidationError({"new_password": "New password cannot be the same as the old password."})
            
        return data
    
class SendInvitationSerializer(serializers.ModelSerializer):
    workspace_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional. ID of the workspace to add the user to. If not provided, user is added to the default workspace.",
    )

    class Meta:
        model = Invitation
        fields = ['email', 'role', 'workspace_id']

    def validate_role(self, value):
        if value not in [choice[0] for choice in User.Role.choices]:
            raise serializers.ValidationError("Invalid role selected.")
        return value

    def validate_workspace_id(self, value):
        if value is None:
            return value
        from apps.organizations.models import Workspace
        request = self.context.get('request')
        if request:
            try:
                workspace = Workspace.objects.get(
                    id=value,
                    organization=request.user.organization,
                    is_active=True,
                )
            except Workspace.DoesNotExist:
                raise serializers.ValidationError(
                    "Workspace not found or does not belong to your organization."
                )
        return value

class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    username = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    password_confirm = serializers.CharField(write_only=True, required=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        
        # Check if username already exists
        if User.objects.filter(username=data['username']).exists():
             raise serializers.ValidationError({"username": "This username is already taken."})
             
        return data

class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['name', 'email', 'company', 'problem','source']

# ---------------------------------------------------------------------------
# DyuksaTokenObtainPairSerializer — custom JWT serializer for SSO
# ---------------------------------------------------------------------------

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class DyuksaTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default simplejwt serializer to inject SSO claims into
    every JWT issued by the PM backend (Central Auth).

    Extra claims added to the token payload:
        email       — user's email address
        role        — user's role within their organisation
        org_id      — organisation primary key
        org_slug    — organisation slug (used for URL routing on frontends)
        org_name    — organisation display name
        platforms   — list of platform keys the org is currently allowed to
                      access e.g. ["pm", "hrms"]

    These claims are read by:
        - HRMS / CRM Django backends  → to verify platform access on every request
        - React frontends             → to show/hide platform navigation
        - Superuser Panel             → not used (superuser has direct DB access)

    IMPORTANT: This serializer does NOT change the login endpoint URL or
    request/response shape.  The only difference is the token payload is
    now richer.  All existing login flows (email/password, OAuth, invitation
    accept) continue to work exactly as before.
    """

    @classmethod
    def get_token(cls, user):
        # Get the base token from simplejwt (contains user_id, exp, jti, etc.)
        token = super().get_token(user)

        # ── Basic user claims ─────────────────────────────────────────────
        token["email"] = user.email
        token["role"]  = user.role

        # ── Organisation claims ───────────────────────────────────────────
        # Guard against users with no organisation (e.g. superuser created
        # directly in Django admin without going through TenantSignupView)
        if user.organization_id is not None:
            token["org_id"]   = user.organization_id
            token["org_slug"] = user.organization.slug
            token["org_name"] = user.organization.name

            # ── Platform access claims ────────────────────────────────────
            # Query PlatformAccess for this org — only include platforms
            # that are active both at the org level AND the global level.
            # This query is intentionally kept outside TenantManager scope
            # because PlatformAccess is not a TenantModel.
            from apps.organizations.models import PlatformAccess

            platforms = list(
                PlatformAccess.objects.filter(
                    organization_id=user.organization_id,
                    is_active=True,                  # org-level switch
                    platform__is_active=True,        # global platform switch
                ).values_list("platform__key", flat=True)
            )
            token["platforms"] = platforms
        else:
            # Superuser or admin account with no org — grant no platform access
            # via JWT (they use the Django admin panel directly instead)
            token["org_id"]   = None
            token["org_slug"] = None
            token["org_name"] = None
            token["platforms"] = []

        return token