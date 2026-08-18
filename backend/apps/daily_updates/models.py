from django.db import models
from django.conf import settings
from datetime import date
import uuid
class DailyUpdate(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='daily_updates'
    )
    date = models.DateField(default=date.today)
    content = models.TextField(help_text="The user's daily update content")
    
    # Audit timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Crucial: Ensures a user can only have one update per specific date
        unique_together = ['user', 'date']
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"Update by {self.user.username} on {self.date}"
    
class Event(models.Model):
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='organized_events'
    )
    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=100, default='Meeting')
    
    attendees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, 
        through='EventInvitation',
        related_name='attending_events',
        blank=True
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True, null=True)
    is_online_meeting = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True)
    
    # Audit timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f"{self.title} organized by {self.organizer.username}"
    
# Add this below your Event class in models.py

class EventInvitation(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('DECLINED', 'Declined'),
        ('RESCHEDULE_REQUESTED', 'Reschedule Requested')
    ]

    event = models.ForeignKey(
        'Event', 
        on_delete=models.CASCADE, 
        related_name='invitations'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='event_invitations'
    )
    status = models.CharField(
        max_length=25, 
        choices=STATUS_CHOICES, 
        default='PENDING'
    )
    decline_reason = models.TextField(blank=True, null=True)
    proposed_reschedule_time = models.DateTimeField(blank=True, null=True)
    
    # Audit timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # A user should only have one invitation per event
        unique_together = ['event', 'user']
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation for {self.user.username} to {self.event.title} ({self.status})"
class CalendarShare(models.Model):
    PERMISSION_CHOICES = [
        ('view', 'View Only'),
        ('edit', 'Can Edit'),
        ('full', 'Full Access')
    ]
    
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='shared_calendars'
    )
    shared_with = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='calendars_shared_with_me'
    )
    permission = models.CharField(
        max_length=10, 
        choices=PERMISSION_CHOICES, 
        default='view'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevent duplicate sharing records between the same two users
        unique_together = ['owner', 'shared_with']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.owner.username} shared with {self.shared_with.username} ({self.permission})"
class CalendarShareLink(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='calendar_links'
    )
    # UUIDs are virtually impossible to guess, making them perfect for share links
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    # Audit timestamp
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Public link for {self.owner.username} (Active: {self.is_active})"