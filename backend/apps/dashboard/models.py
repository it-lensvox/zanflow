from django.db import models
from django.conf import settings


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