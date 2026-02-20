"""
Ground Truth management models for ZanFlow.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.projects.models import Project
from apps.organizations.models import TenantModel
from core.models import UserStampedModel


def document_upload_path(instance, filename):
    """Generate upload path for document source files."""
    # If this file belongs to a task, put it in the task_documents folder
    if hasattr(instance, 'task') and instance.task:
        return f"task_documents/task_{instance.task.id}/{filename}"
    
    # Otherwise, it goes in the standard project folder
    return f"projects/{instance.project_id}/documents/{instance.id}/source/{filename}"


class Document(TenantModel, UserStampedModel):
    """
    Document with source file and ground truth data.
    """
    
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_REVIEW = "in_review", "In Review"
        APPROVED = "approved", "Approved"
        ARCHIVED = "archived", "Archived"
    
    class FileType(models.TextChoices):
        PDF = "pdf", "PDF"
        IMAGE = "image", "Image"
        JSON = "json", "JSON"
        TEXT = "text", "Text"
        VIDEO = "video", "Video"
        MP4 = "mp4", "MP4"
        OTHER = "other", "Other"
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    
    # --- ADD THIS NEW FIELD ---
    # We use a string 'tasksite.Task' to prevent circular import errors
    task = models.ForeignKey(
        'tasksite.Task',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Source file
    source_file = models.FileField(upload_to=document_upload_path, null=True, blank=True)
    source_file_url = models.URLField(max_length=2000, blank=True)
    file_type = models.CharField(max_length=20, choices=FileType.choices, default=FileType.PDF)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    
    # Status & workflow
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    
    # Current approved GT version
    current_gt_version = models.ForeignKey(
        "GTVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_for_documents",
    )
    
    class Meta:
        db_table = "documents"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["project", "created_at"]),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.project.name})"
    
    @property
    def latest_version(self):
        return self.versions.order_by("-version_number").first()
    
    @property
    def version_count(self):
        return self.versions.count()


class GTVersion(TenantModel, UserStampedModel):
    """
    Ground Truth version with full change tracking.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    
    version_number = models.PositiveIntegerField()
    
    # The actual ground truth data
    gt_data = models.JSONField(default=dict)
    
    # Change tracking
    change_summary = models.TextField(blank=True)
    changes_from_previous = models.JSONField(default=dict, blank=True)
    
    # Approval tracking
    is_approved = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_versions",
    )
    
    # Optional: link to source of this GT
    source_type = models.CharField(max_length=50, default="manual")
    source_reference = models.CharField(max_length=255, blank=True)
    
    class Meta:
        db_table = "gt_versions"
        ordering = ["-version_number"]
        unique_together = ["document", "version_number"]
    
    def __str__(self):
        return f"{self.document.name} v{self.version_number}"
    
    def save(self, *args, **kwargs):
        if not self.version_number:
            last_version = GTVersion.original_objects.filter(
                document=self.document
            ).order_by("-version_number").first()
            self.version_number = (last_version.version_number + 1) if last_version else 1
        super().save(*args, **kwargs)


class DocumentComment(TenantModel, UserStampedModel):
    """
    Comments on documents for collaboration.
    """
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    gt_version = models.ForeignKey(
        GTVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comments",
    )
    
    content = models.TextField()
    
    # Optional: reference to specific field in GT
    field_reference = models.CharField(max_length=255, blank=True)
    
    # Reply threading
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    
    is_resolved = models.BooleanField(default=False)
    
    class Meta:
        db_table = "document_comments"
        ordering = ["created_at"]
    
    def __str__(self):
        return f"Comment on {self.document.name} by {self.created_by}"
