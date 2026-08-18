from rest_framework import serializers
from .models import (
    CustomDashboard,
    UserPreference,
    DASHBOARD_DATE_RANGE_CHOICES,
    DASHBOARD_DATE_RANGE_DEFAULT,
)

VALID_DATE_RANGES = {choice[0] for choice in DASHBOARD_DATE_RANGE_CHOICES}


class UserPreferenceSerializer(serializers.Serializer):
    """
    Validates and serialises the flat preferences object exposed by the API.

    Only known keys are validated; unknown keys are silently ignored on write
    so future frontend features don't break existing validation.
    """
    dashboard_date_range = serializers.ChoiceField(
        choices=DASHBOARD_DATE_RANGE_CHOICES,
        default=DASHBOARD_DATE_RANGE_DEFAULT,
        required=False,
    )

    def to_representation(self, instance):
        """
        Always return the full defaults-merged object so the frontend gets
        every key even if the user has never saved a preference.
        """
        raw = instance.data if isinstance(instance, UserPreference) else {}
        return {
            "dashboard_date_range": raw.get(
                "dashboard_date_range", DASHBOARD_DATE_RANGE_DEFAULT
            ),
        }

    def validate_dashboard_date_range(self, value):
        if value not in VALID_DATE_RANGES:
            raise serializers.ValidationError(
                f"Invalid value. Must be one of: {', '.join(sorted(VALID_DATE_RANGES))}."
            )
        return value


class CustomDashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomDashboard
        fields = ["id", "name", "is_default", "widgets", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("This field may not be blank.")
        return value