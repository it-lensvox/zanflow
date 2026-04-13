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

    def validate(self, data):
        # 1. Safely extract start_time, end_time, and attendees
        # Fallback to the existing instance values if this is a partial update (PATCH)
        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = data.get('end_time', getattr(self.instance, 'end_time', None))
        attendees = data.get('attendees', [])

        # Basic sanity check
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({
                "end_time": "End time must be after the start time."
            })

        # If no attendees are being added, we can skip the attendee validation
        if not attendees:
            return data

        event_date = start_time.date()
        
        # 2. Base QuerySet: All events
        # If we are updating an existing event, exclude it from the checks 
        # so it doesn't conflict with itself.
        existing_events = Event.objects.all()
        if self.instance:
            existing_events = existing_events.exclude(id=self.instance.id)

        # 3. Check rules for each proposed attendee
        for attendee in attendees:
            username = attendee.get_full_name() or attendee.username

            # --- Rule A: Maximum 5 events per day ---
            daily_event_count = existing_events.filter(
                attendees=attendee,
                start_time__date=event_date
            ).count()

            if daily_event_count >= 5:
                raise serializers.ValidationError({
                    "attendees": f"Cannot add {username}: They have already reached the maximum limit of 5 events on {event_date}."
                })

            # --- Rule B: Time Overlap Check ---
            # Logic: Two events overlap if Event A starts before Event B ends, 
            # AND Event A ends after Event B starts.
            overlapping_events = existing_events.filter(
                attendees=attendee,
                start_time__lt=end_time,
                end_time__gt=start_time
            )

            if overlapping_events.exists():
                raise serializers.ValidationError({
                    "attendees": f"Cannot add {username}: They already have a conflicting event scheduled during this time."
                })

        return data