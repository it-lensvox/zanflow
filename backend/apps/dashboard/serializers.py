from rest_framework import serializers
from .models import CustomDashboard


class CustomDashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomDashboard
        fields = ["id", "name", "is_default", "widgets", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("This field may not be blank.")
        return value