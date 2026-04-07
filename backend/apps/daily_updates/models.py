from django.db import models
from django.conf import settings
from datetime import date

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
    attendees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, 
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