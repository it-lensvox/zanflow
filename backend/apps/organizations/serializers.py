from rest_framework import serializers

from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name", "slug", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "slug", "created_at", "updated_at")


class TenantSignupSerializer(serializers.Serializer):
    """
    Public signup serializer — no authentication required.
    Creates an organization + superuser in one step.
    """

    company_name = serializers.CharField(
        max_length=255,
        help_text="Name of the organization/company",
    )
    admin_email = serializers.EmailField(
        help_text="Email for the admin account (used for login)",
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        help_text="Password (minimum 8 characters)",
    )
    password_confirm = serializers.CharField(
        write_only=True,
        help_text="Confirm password",
    )

    def validate_company_name(self, value):
        """Check that organization name is unique."""
        if Organization.objects.filter(name__iexact=value.strip()).exists():
            raise serializers.ValidationError(
                "An organization with this name already exists."
            )
        return value.strip()

    def validate_admin_email(self, value):
        """Check that email is not already registered."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value.lower()

    def validate(self, data):
        """Ensure passwords match."""
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return data