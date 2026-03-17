"""
Chat models for ZanFlow.

Models:
- ChatRoom: Represents chat rooms (global, project-based, or private)
- ChatMessage: Stores individual chat messages
- ChatRoomMembership: Tracks room membership and read status
- MessageReadStatus: Tracks read receipts

Now with multi-tenant support.
"""
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.organizations.models import TenantModel
from apps.teams.models import Team


class ChatRoom(TenantModel):
    """
    Chat room model supporting multiple types.
    Tenant-scoped via TenantModel.
    """
    
    class RoomType(models.TextChoices):
        GLOBAL = 'global', 'Global Chat'
        PROJECT = 'project', 'Project Chat'
        PRIVATE = 'private', 'Private Chat'
        TEAM = 'team', 'Team Chat'
        THREAD = 'thread', 'Thread Chat'
        # AI_BOT = 'ai_bot', 'AI Bot Chat'
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Room display name (auto-generated for private chats)"
    )
    room_type = models.CharField(
        max_length=20,
        choices=RoomType.choices,
        default=RoomType.PRIVATE,
        db_index=True
    )
    team = models.ForeignKey(
        'teams.Team',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='chat_rooms',
        help_text="Associated team for team-type rooms"
    )
    
    # For project-based rooms
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='chat_rooms',
        help_text="Associated project for project-type rooms"
    )
    
    # Room participants
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='ChatRoomMembership',
        related_name='chat_rooms',
        blank=True
    )
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_chat_rooms'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    slug = models.SlugField(
        max_length=100,
        unique=True,
        blank=True,
        help_text="Unique identifier for WebSocket channel"
    )
    parent_message = models.ForeignKey(
        'ChatMessage',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='child_threads',
        help_text="The original message this thread branched from"
    )
    class Meta:
        db_table = 'chat_rooms'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['room_type', 'is_active']),
            models.Index(fields=['project', 'room_type']),
        ]

    def __str__(self):
        if self.room_type == self.RoomType.GLOBAL:
            return f"Global: {self.name}"
        elif self.room_type == self.RoomType.PROJECT:
            return f"Project: {self.project.name if self.project else 'Unknown'}"
        elif self.room_type == self.RoomType.TEAM:
            return f"Team: {self.team.name if self.team else 'Unknown'}"
        # elif self.room_type == self.RoomType.AI_BOT: # <-- NEW
        #     return f"AI Bot: {self.name}"
        return f"Private: {self.name}"

    def save(self, *args, **kwargs):
        """Auto-generate slug if not provided."""
        if not self.slug:
            self.slug = str(uuid.uuid4())[:12]
        super().save(*args, **kwargs)

    @property
    def channel_group_name(self):
        return f"chat_{self.slug}"

    def get_participant_ids(self):
        return list(self.participants.values_list('id', flat=True))

    def is_participant(self, user):
        if self.room_type == self.RoomType.GLOBAL:
            return True
        return self.participants.filter(id=user.id).exists()


class ChatRoomMembership(models.Model):
    """
    Tracks user membership in chat rooms.
    NOT directly tenant-scoped — implicitly scoped via ChatRoom FK.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_memberships'
    )
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    
    # Tracking
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(default=timezone.now)
    is_muted = models.BooleanField(
        default=False,
        help_text="If true, user won't receive notifications"
    )
    is_favourite = models.BooleanField(
        default=False,
        help_text="If true, this room is pinned or marked as favorite by the user"
    )
    
    class RoomRole(models.TextChoices):
        MEMBER = 'member', 'Member'
        MODERATOR = 'moderator', 'Moderator'
        ADMIN = 'admin', 'Admin'
    
    room_role = models.CharField(
        max_length=20,
        choices=RoomRole.choices,
        default=RoomRole.MEMBER
    )

    class Meta:
        db_table = 'chat_room_memberships'
        unique_together = ['user', 'room']
        indexes = [
            models.Index(fields=['user', 'room']),
            models.Index(fields=['last_read_at']),
        ]

    def __str__(self):
        return f"{self.user.username} in {self.room.name}"

    def mark_as_read(self):
        self.last_read_at = timezone.now()
        self.save(update_fields=['last_read_at'])


class ChatMessage(TenantModel):
    """
    Individual chat message model.
    Tenant-scoped via TenantModel.
    """
    
    class MessageType(models.TextChoices):
        TEXT = 'text', 'Text Message'
        IMAGE = 'image', 'Image'
        FILE = 'file', 'File Attachment'
        SYSTEM = 'system', 'System Message'
        LINK = 'link', 'Link'
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='chat_messages'
    )
    
    # Content
    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.TEXT
    )
    content = models.TextField(
        blank=True,
        help_text="Message text content"
    )
    
    # File attachment
    attachment = models.FileField(
        upload_to='chat_attachments/%Y/%m/%d/',
        blank=True,
        null=True
    )
    attachment_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Original filename of attachment"
    )
    metadata = models.JSONField(
        default=dict, 
        blank=True, 
        help_text="Stores link preview data or file metadata"
    )

    # Reply functionality
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies',
        help_text="Message being replied to"
    )
    is_ai_generated = models.BooleanField(
        default=False,
        help_text="True if this message was generated by the @zanflow AI"
    )
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Soft delete
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['room', 'created_at']),
            models.Index(fields=['sender', 'created_at']),
            models.Index(fields=['room', '-created_at']),
        ]

    def __str__(self):
        sender_name = self.sender.username if self.sender else 'System'
        content_preview = self.content[:50] if self.content else '[attachment]'
        return f"{sender_name}: {content_preview}"

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def to_websocket_dict(self):
        return {
            'id': str(self.id),
            'room_id': str(self.room_id),
            'sender': {
                'id': self.sender.id if self.sender else None,
                'username': self.sender.username if self.sender else 'System',
                'full_name': self.sender.get_full_name() if self.sender else 'System',
            },
            'message_type': self.message_type,
            'content': self.content if not self.is_deleted else '[Message deleted]',
            'attachment_url': self.attachment.url if self.attachment else None,
            'attachment_name': self.attachment_name,
            'reply_to': str(self.reply_to_id) if self.reply_to_id else None,
            'created_at': self.created_at.isoformat(),
            'is_deleted': self.is_deleted,
            'is_ai_generated': self.is_ai_generated,  # <-- NEW
            # <-- NEW: Let frontend know if this message has active threads
            'thread_count': self.child_threads.filter(is_active=True).count() if hasattr(self, 'child_threads') else 0,
        }


class MessageReadStatus(models.Model):
    """
    Tracks read receipts.
    NOT directly tenant-scoped — implicitly scoped via ChatMessage FK.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    message = models.ForeignKey(
        ChatMessage,
        on_delete=models.CASCADE,
        related_name='read_statuses'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='message_read_statuses'
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_message_read_status'
        unique_together = ['message', 'user']
        indexes = [
            models.Index(fields=['message', 'user']),
        ]

    def __str__(self):
        return f"{self.user.username} read {self.message_id}"
