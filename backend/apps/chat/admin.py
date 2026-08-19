"""
Django admin configuration for chat models.
"""
from django.contrib import admin
from django.utils.html import format_html

from .models import ChatRoom, ChatMessage, ChatRoomMembership, MessageReadStatus


class ChatRoomMembershipInline(admin.TabularInline):
    """Inline for room memberships in ChatRoom admin."""
    model = ChatRoomMembership
    extra = 0
    readonly_fields = ['joined_at', 'last_read_at']
    autocomplete_fields = ['user']


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    """Admin configuration for ChatRoom model."""
    list_display = [
        'name', 'room_type', 'slug', 'project_link',
        'participant_count', 'message_count', 'is_active',
        'created_at', 'updated_at'
    ]
    list_filter = ['room_type', 'is_active', 'created_at']
    search_fields = ['name', 'slug', 'project__name']
    readonly_fields = ['id', 'slug', 'created_at', 'updated_at']
    autocomplete_fields = ['project', 'created_by']
    inlines = [ChatRoomMembershipInline]
    
    fieldsets = (
        (None, {
            'fields': ('name', 'room_type', 'slug', 'is_active')
        }),
        ('Associations', {
            'fields': ('project', 'created_by')
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def project_link(self, obj):
        """Link to associated project."""
        if obj.project:
            return format_html(
                '<a href="/admin/projects/project/{}/change/">{}</a>',
                obj.project.id,
                obj.project.name
            )
        return '-'
    project_link.short_description = 'Project'

    def participant_count(self, obj):
        """Number of participants."""
        return obj.participants.count()
    participant_count.short_description = 'Participants'

    def message_count(self, obj):
        """Number of messages in room."""
        return obj.messages.count()
    message_count.short_description = 'Messages'


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    """Admin configuration for ChatMessage model."""
    list_display = [
        'id_short', 'room_name', 'sender_name', 'message_type',
        'content_preview', 'is_deleted', 'created_at'
    ]
    list_filter = ['message_type', 'is_deleted', 'created_at', 'room__room_type']
    search_fields = ['content', 'sender__username', 'room__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'deleted_at']
    autocomplete_fields = ['room', 'sender', 'reply_to']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        (None, {
            'fields': ('room', 'sender', 'message_type')
        }),
        ('Content', {
            'fields': ('content', 'attachment', 'attachment_name', 'reply_to')
        }),
        ('Status', {
            'fields': ('is_deleted', 'deleted_at')
        }),
        ('Metadata', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def id_short(self, obj):
        """Shortened ID for display."""
        return str(obj.id)[:8]
    id_short.short_description = 'ID'

    def room_name(self, obj):
        """Room name."""
        return obj.room.name
    room_name.short_description = 'Room'

    def sender_name(self, obj):
        """Sender username."""
        return obj.sender.username if obj.sender else 'System'
    sender_name.short_description = 'Sender'

    def content_preview(self, obj):
        """Truncated content preview."""
        if obj.is_deleted:
            return '[Deleted]'
        if not obj.content:
            return '[Attachment]'
        return obj.content[:50] + ('...' if len(obj.content) > 50 else '')
    content_preview.short_description = 'Content'


@admin.register(ChatRoomMembership)
class ChatRoomMembershipAdmin(admin.ModelAdmin):
    """Admin configuration for ChatRoomMembership model."""
    list_display = [
        'user', 'room', 'room_role', 'is_muted',
        'joined_at', 'last_read_at'
    ]
    list_filter = ['room_role', 'is_muted', 'joined_at', 'room__room_type']
    search_fields = ['user__username', 'room__name']
    readonly_fields = ['id', 'joined_at']
    autocomplete_fields = ['user', 'room']


@admin.register(MessageReadStatus)
class MessageReadStatusAdmin(admin.ModelAdmin):
    """Admin configuration for MessageReadStatus model."""
    list_display = ['user', 'message_preview', 'read_at']
    list_filter = ['read_at']
    search_fields = ['user__username', 'message__content']
    readonly_fields = ['id', 'read_at']
    autocomplete_fields = ['user', 'message']

    def message_preview(self, obj):
        """Preview of the message."""
        return str(obj.message)[:50]
    message_preview.short_description = 'Message'
