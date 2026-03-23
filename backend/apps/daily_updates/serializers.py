from rest_framework import serializers
from .models import DailyUpdate

class DailyUpdateSerializer(serializers.ModelSerializer):
    # Helpful to display the name on the frontend calendar
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = DailyUpdate
        fields = ['id', 'user', 'user_name', 'date', 'content', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']