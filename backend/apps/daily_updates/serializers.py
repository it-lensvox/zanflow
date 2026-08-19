from rest_framework import serializers
from .models import DailyUpdate, Event, EventInvitation ,CalendarShare
from django.contrib.auth import get_user_model
from .models import CalendarShareLink
User = get_user_model()
class DailyUpdateSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = DailyUpdate
        fields = ['id', 'user', 'user_name', 'date', 'content', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']


class EventSerializer(serializers.ModelSerializer):
    organizer_name = serializers.CharField(source='organizer.get_full_name', read_only=True)
    attendees = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        required=False
    )
    my_invitation_status = serializers.SerializerMethodField()
    my_invitation_id = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id', 'organizer', 'organizer_name', 'title', 
            'event_type',  # <--- 2. ADD IT HERE
            'attendees', 'start_time', 'end_time', 'location', 
            'is_online_meeting', 'description', 
            'my_invitation_status', 'my_invitation_id', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['organizer', 'created_at', 'updated_at']

    # 2. ADD THIS METHOD TO CALCULATE STATUS
    def get_my_invitation_status(self, obj):
        request = self.context.get('request')
        # Safety check if request is not in context
        if not request or not hasattr(request, 'user'):
            return None
            
        # If the logged-in user created the event, they are the organizer
        if obj.organizer == request.user:
            return 'ORGANIZER'
            
        # Otherwise, find their specific invitation and return its status
        invitation = obj.invitations.filter(user=request.user).first()
        return invitation.status if invitation else None

    # 3. ADD THIS METHOD TO FETCH THE ID
    def get_my_invitation_id(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return None
            
        invitation = obj.invitations.filter(user=request.user).first()
        return invitation.id if invitation else None

    # 2. METHODS TO FETCH THE LOGGED-IN USER'S INVITATION DATA
    def get_my_invitation_status(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return None
            
        if obj.organizer == request.user:
            return 'ORGANIZER'
            
        invitation = obj.invitations.filter(user=request.user).first()
        return invitation.status if invitation else None

    def get_my_invitation_id(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return None
            
        invitation = obj.invitations.filter(user=request.user).first()
        return invitation.id if invitation else None

    def validate(self, data):
        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = data.get('end_time', getattr(self.instance, 'end_time', None))

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({
                "end_time": "End time must be after the start time."
            })
        return data

    def create(self, validated_data):
        # 1. Pop the attendees out of the data first
        attendees = validated_data.pop('attendees', [])
        
        # 2. Create the base Event
        event = super().create(validated_data)
        
        # --- THE FIX: Deduplicate the attendees to prevent IntegrityErrors ---
        unique_attendees = set(attendees)
        
        # 3. Create invitations ONE BY ONE so the post_save signal fires
        for attendee in unique_attendees:
            # Pro-tip: If the attendee is the organizer, auto-accept their invitation!
            invitation_status = 'ACCEPTED' if attendee == event.organizer else 'PENDING'
            
            EventInvitation.objects.create(
                event=event, 
                user=attendee, 
                status=invitation_status
            )
        
        # 4. Refresh the event from the DB so the response JSON includes the attendees
        event.refresh_from_db()
        
        return event
# Add this new serializer for when we build the API endpoints
class EventInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventInvitation
        fields = ['id', 'event', 'user', 'status', 'decline_reason', 'proposed_reschedule_time']
        read_only_fields = ['event', 'user']

class CalendarShareSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.get_full_name', read_only=True)
    shared_with_name = serializers.CharField(source='shared_with.get_full_name', read_only=True)

    class Meta:
        model = CalendarShare
        fields = ['id', 'owner', 'owner_name', 'shared_with', 'shared_with_name', 'permission', 'created_at']
        read_only_fields = ['owner', 'created_at']

class CalendarShareLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarShareLink
        fields = ['id', 'token', 'is_active', 'expires_at', 'created_at']
        read_only_fields = ['token', 'created_at']

# 2. Ultra-safe serializer for the public view
class PublicEventSerializer(serializers.ModelSerializer):
    """
    Strips away attendees, descriptions, and internal IDs. 
    Only shows the bare minimum needed for a calendar grid.
    """
    organizer_name = serializers.CharField(source='organizer.get_full_name', read_only=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'organizer_name', 'title', 'event_type', 
            'start_time', 'end_time', 'is_online_meeting'
        ]