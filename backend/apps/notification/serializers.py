"""
Serializers for Notifications app.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Notification, NotificationPreference

User = get_user_model()


class ActorSerializer(serializers.ModelSerializer):
    """Minimal serializer for the actor (user who triggered notification)."""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email']
        read_only_fields = fields
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for Notification model.
    Used for listing and retrieving notifications.
    """
    actor = ActorSerializer(read_only=True)
    notification_type_display = serializers.CharField(
        source='get_notification_type_display',
        read_only=True
    )
    priority_display = serializers.CharField(
        source='get_priority_display',
        read_only=True
    )
    time_since = serializers.SerializerMethodField()
    related_object_info = serializers.SerializerMethodField()
    workspace_name = serializers.SerializerMethodField()
    workspace_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'notification_type',
            'notification_type_display',
            'priority',
            'priority_display',
            'actor',
            'is_read',
            'read_at',
            'metadata',
            'related_object_info',
            'time_since',
            'workspace_name',
            'workspace_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_workspace_name(self, obj):
        if obj.workspace:
            return obj.workspace.name
        return None

    def get_workspace_id(self, obj):
        return obj.workspace_id
    
    def get_time_since(self, obj):
        """Return human-readable time since notification was created."""
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            minutes = int(diff.total_seconds() / 60)
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif diff < timedelta(days=1):
            hours = int(diff.total_seconds() / 3600)
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif diff < timedelta(days=7):
            days = diff.days
            return f"{days} day{'s' if days != 1 else ''} ago"
        elif diff < timedelta(days=30):
            weeks = diff.days // 7
            return f"{weeks} week{'s' if weeks != 1 else ''} ago"
        else:
            return obj.created_at.strftime("%b %d, %Y")
    
    def get_related_object_info(self, obj):
        """Return basic info about the related object."""
        if not obj.content_type or not obj.object_id:
            return None
        
        return {
            'type': obj.content_type.model,
            'app': obj.content_type.app_label,
            'id': obj.object_id,
        }


class NotificationListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for notification lists.
    Optimized for performance when fetching many notifications.
    """
    actor_name = serializers.SerializerMethodField()
    time_since = serializers.SerializerMethodField()
    workspace_name = serializers.SerializerMethodField()
    workspace_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'notification_type',
            'priority',
            'actor_name',
            'is_read',
            'metadata',
            'time_since',
            'created_at',
            'workspace_name',
            'workspace_id',
        ]
        read_only_fields = fields

    def get_workspace_name(self, obj):
        if obj.workspace:
            return obj.workspace.name
        return None

    def get_workspace_id(self, obj):
        return obj.workspace_id
    
    def get_actor_name(self, obj):
        if obj.actor:
            return f"{obj.actor.first_name} {obj.actor.last_name}".strip() or obj.actor.username
        return None
    
    def get_time_since(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            minutes = int(diff.total_seconds() / 60)
            return f"{minutes}m ago"
        elif diff < timedelta(days=1):
            hours = int(diff.total_seconds() / 3600)
            return f"{hours}h ago"
        elif diff < timedelta(days=7):
            days = diff.days
            return f"{days}d ago"
        else:
            return obj.created_at.strftime("%b %d")


class MarkAsReadSerializer(serializers.Serializer):
    """Serializer for marking notifications as read."""
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="List of notification IDs to mark as read. If empty, marks all as read."
    )


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for user notification preferences."""
    
    class Meta:
        model = NotificationPreference
        fields = [
            'task_notifications',
            'project_notifications',
            'mention_notifications',
            'system_notifications',
            'email_task_notifications',
            'email_project_notifications',
            'updated_at',
        ]
        read_only_fields = ['updated_at']


class NotificationCountSerializer(serializers.Serializer):
    """Serializer for notification counts."""
    total = serializers.IntegerField()
    unread = serializers.IntegerField()
    by_type = serializers.DictField(child=serializers.IntegerField())