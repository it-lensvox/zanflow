"""
Notification models for ZanFlow.
Centralized notification system for in-app notifications.
Now with multi-tenant support.
"""
from django.conf import settings
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.organizations.models import TenantModel


class Notification(TenantModel):
    """
    Notification model for storing in-app notifications.
    Uses GenericForeignKey to link to any model (Task, Project, etc.)
    """
    
    class NotificationType(models.TextChoices):
        # Task related
        TASK_CREATED = 'task_created', 'Task Created'
        TASK_ASSIGNED = 'task_assigned', 'Task Assigned'
        TASK_STATUS_UPDATED = 'task_status_updated', 'Task Status Updated'
        TASK_COMPLETED = 'task_completed', 'Task Completed'
        TASK_COMMENT = 'task_comment', 'Task Comment'
        
        # Project related
        PROJECT_CREATED = 'project_created', 'Project Created'
        PROJECT_ASSIGNED = 'project_assigned', 'Project Assigned'
        PROJECT_MEMBER_ADDED = 'project_member_added', 'Project Member Added'
        PROJECT_UPDATED = 'project_updated', 'Project Updated'
        
        # General
        MENTION = 'mention', 'Mention'
        REMINDER = 'reminder', 'Reminder'
        SYSTEM = 'system', 'System Notification'
    
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'
    
    # Recipient of the notification
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    
    # Actor who triggered the notification (nullable for system notifications)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_notifications'
    )
    
    # Notification type and priority
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM
    )
    
    # Content
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # Generic relation to any model (Task, Project, etc.)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    object_id = models.CharField(max_length=255, null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True)
    
    # Status tracking
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
            models.Index(fields=['notification_type']),
        ]
    
    def __str__(self):
        return f"{self.notification_type} for {self.recipient.username}: {self.title[:50]}"
    
    def mark_as_read(self):
        """Mark the notification as read."""
        from django.utils import timezone
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at', 'updated_at'])
    
    def mark_as_unread(self):
        """Mark the notification as unread."""
        if self.is_read:
            self.is_read = False
            self.read_at = None
            self.save(update_fields=['is_read', 'read_at', 'updated_at'])


class NotificationPreference(models.Model):
    """
    User notification preferences.
    NOT tenant-scoped — one-to-one with User (implicitly scoped via User's org).
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    
    # In-app notification preferences
    task_notifications = models.BooleanField(default=True)
    project_notifications = models.BooleanField(default=True)
    mention_notifications = models.BooleanField(default=True)
    system_notifications = models.BooleanField(default=True)
    
    # Future: Email notification preferences
    email_task_notifications = models.BooleanField(default=False)
    email_project_notifications = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'notification_preferences'
    
    def __str__(self):
        return f"Notification preferences for {self.user.username}"
    
    @receiver(post_delete)
    def delete_related_notifications(sender, instance, **kwargs):
        """
        Automatically delete notifications when the related object is deleted.
        """
        content_type = ContentType.objects.get_for_model(instance)
        Notification.original_objects.filter(
            content_type=content_type,
            object_id=instance.pk
        ).delete()
