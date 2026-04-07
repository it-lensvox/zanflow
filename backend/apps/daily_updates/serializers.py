from rest_framework import serializers
from .models import DailyUpdate, Event

class DailyUpdateSerializer(serializers.ModelSerializer):
    # Helpful to display the name on the frontend calendar
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = DailyUpdate
        fields = ['id', 'user', 'user_name', 'date', 'content', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']

class EventSerializer(serializers.ModelSerializer):
    organizer_name = serializers.CharField(source='organizer.get_full_name', read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'organizer', 'organizer_name', 'title', 'attendees', 
            'start_time', 'end_time', 'location', 'is_online_meeting', 
            'description', 'created_at', 'updated_at'
        ]
        read_only_fields = ['organizer', 'created_at', 'updated_at']