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