"""
Chat models for ZanFlow.

Models:
- ChatRoom: Represents chat rooms (global, project-based, or private)
- ChatMessage: Stores individual chat messages
- ChatRoomMembership: Tracks room membership and read status
"""
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.teams.models import Team

class ChatRoom(models.Model):
    """
    Chat room model supporting three types:
    - GLOBAL: All users can participate
    - PROJECT: Project-specific group chat
    - PRIVATE: One-to-one direct messages
    """
    
    class RoomType(models.TextChoices):
        GLOBAL = 'global', 'Global Chat'
        PROJECT = 'project', 'Project Chat'
        PRIVATE = 'private', 'Private Chat'
        TEAM = 'team', 'Team Chat'
    
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
        'teams.Team',  # Replace with the actual path to your Team model
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='chat_rooms',
        help_text="Associated team for team-type rooms"
    )
    
    # For project-based rooms - links to existing Project model
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='chat_rooms',
        help_text="Associated project for project-type rooms"
    )
    
    # Room participants (for private and project chats)
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
    
    # For generating unique channel names
    slug = models.SlugField(
        max_length=100,
        unique=True,
        blank=True,
        help_text="Unique identifier for WebSocket channel"
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
        elif self.room_type == self.RoomType.TEAM:  # <--- Add this check
            return f"Team: {self.team.name if self.team else 'Unknown'}"
        return f"Private: {self.name}"

    def save(self, *args, **kwargs):
        """Auto-generate slug if not provided."""
        if not self.slug:
            self.slug = str(uuid.uuid4())[:12]
        super().save(*args, **kwargs)

    @property
    def channel_group_name(self):
        """
        Generate unique channel layer group name.
        Used by Django Channels for broadcasting messages.
        """
        return f"chat_{self.slug}"

    def get_participant_ids(self):
        """Return list of participant user IDs."""
        return list(self.participants.values_list('id', flat=True))

    def is_participant(self, user):
        """Check if user is a participant in this room."""
        if self.room_type == self.RoomType.GLOBAL:
            return True  # Everyone can access global chat
        return self.participants.filter(id=user.id).exists()


class ChatRoomMembership(models.Model):
    """
    Tracks user membership in chat rooms.
    Stores read status and notification preferences.
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
    
    # Role within the room (optional for moderation)
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
        """Update last_read_at timestamp."""
        self.last_read_at = timezone.now()
        self.save(update_fields=['last_read_at'])


class ChatMessage(models.Model):
    """
    Individual chat message model.
    Supports text messages with optional file attachments.
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
    
    # File attachment (optional)
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
        """Soft delete the message."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def to_websocket_dict(self):
        """
        Convert message to dictionary for WebSocket transmission.
        This is the format sent to connected clients.
        """
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
        }


class MessageReadStatus(models.Model):
    """
    Tracks which users have read which messages.
    Used for read receipts in private chats.
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
    # @receiver(post_save, sender=Team)
    # def sync_chat_with_team_deletion(sender, instance, created, **kwargs):
    #     """
    #     When a Team is soft-deleted (deleted_at is set), 
    #     we hide the associated ChatRoom by setting is_active=False.
    #     """
        # # Check if the team has just been soft-deleted
        # if instance.deleted_at is not None:
        #     from .models import ChatRoom
            
        #     # Disable the chat room immediately
        #     ChatRoom.objects.filter(team=instance).update(is_active=False)
