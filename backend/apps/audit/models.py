"""
Audit logging models for ZanFlow.
"""
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class AuditLog(models.Model):
    """
    Comprehensive audit log for all user actions.
    """
    
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        VIEW = "view", "View"
        APPROVE = "approve", "Approve"
        REJECT = "reject", "Reject"
        SUBMIT = "submit", "Submit"
        EXPORT = "export", "Export"
        IMPORT = "import", "Import"
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    
    # Generic relation to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=255) 
    
    content_object = GenericForeignKey("content_type", "object_id")
    
    # Change tracking
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    change_summary = models.TextField(blank=True)
    
    # Request metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["user", "timestamp"]),
        ]
    
    def __str__(self):
        return f"{self.user} {self.action} {self.content_type.model} at {self.timestamp}"
