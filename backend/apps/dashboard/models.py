from django.db import models
from django.conf import settings


DASHBOARD_DATE_RANGE_CHOICES = [
    ("7d",  "Last 7 days"),
    ("30d", "Last 30 days"),
    ("90d", "Last 90 days"),
    ("all", "All time"),
]

DASHBOARD_DATE_RANGE_DEFAULT = "all"


class UserPreference(models.Model):
    """
    Stores per-user UI preferences as a flat JSON blob so new keys can be
    added by future features without schema changes.

    One row per user — created on first PATCH, read on GET (returns defaults
    when the row doesn't exist yet).
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preference",
    )
    data = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences({self.user})"


class CustomDashboard(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="custom_dashboards",
    )
    workspace_id = models.CharField(max_length=255, db_index=True)
    name = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    widgets = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} — {self.name}"