"""
Ground Truth management models for ZanFlow.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.projects.models import Project
from apps.organizations.models import TenantModel
from core.models import UserStampedModel
from django.db.models.signals import post_save
from django.dispatch import receiver

# ============ NEW FOLDER MODEL ============
class Folder(TenantModel, UserStampedModel):
    """
    Hierarchical folder structure for projects.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="folders",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfolders",
    )
    name = models.CharField(max_length=255)
    is_system_generated = models.BooleanField(default=False)

    class Meta:
        db_table = "folders"
        ordering = ["-is_system_generated", "name"] # System folders appear first
        unique_together = [["project", "name", "parent"]] # Prevent duplicate names at same level

    def __str__(self):
        return f"{self.name} - {self.project.name}"
    
def document_upload_path(instance, filename):
    """Generate upload path for document source files."""
    # If this file belongs to a task, put it in the task_documents folder
    if hasattr(instance, 'task') and instance.task:
        return f"task_documents/task_{instance.task.id}/{filename}"
    
    import uuid as _uuid
    doc_id = instance.id if instance.id else _uuid.uuid4()
    return f"projects/{instance.project_id}/documents/{doc_id}/source/{filename}"


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
    
    # ============ ADD THIS NEW CLASS ============
    class PreviewStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"
        NOT_NEEDED = "not_needed", "Not Needed"
    # ============================================
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    
    task = models.ForeignKey(
        'tasksite.Task',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )

    folder = models.ForeignKey(
        Folder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
        help_text="The folder where this document lives."
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Source file
    source_file = models.FileField(upload_to=document_upload_path, null=True, blank=True)
    source_file_url = models.URLField(max_length=2000, blank=True)
    file_type = models.CharField(max_length=20, choices=FileType.choices, default=FileType.PDF)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    
    # ============ ADD THESE NEW FIELDS ============
    preview_pdf = models.FileField(
        upload_to='documents/previews/',
        null=True,
        blank=True,
        help_text="Auto-generated PDF version for browser preview"
    )
    preview_status = models.CharField(
        max_length=20,
        choices=PreviewStatus.choices,
        default=PreviewStatus.PENDING
    )
    preview_error = models.TextField(blank=True, help_text="Error if conversion failed")
    # ==============================================
    
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
    def file_url(self):
        """Always returns the correct file URL, preferring source_file over source_file_url."""
        if self.source_file and self.source_file.name:
            return self.source_file.url
        return self.source_file_url or None
    
    # ============ ADD THIS NEW PROPERTY ============
    @property
    def preview_pdf_url(self):
        """Returns the URL of the converted PDF preview, if available."""
        if self.preview_pdf and self.preview_pdf.name:
            return self.preview_pdf.url
        return None
    # ===============================================
    
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
            from django.db import transaction
            with transaction.atomic():
                last_version = GTVersion.original_objects.select_for_update().filter(
                    document=self.document
                ).order_by("-version_number").first()
                self.version_number = (last_version.version_number + 1) if last_version else 1
                super().save(*args, **kwargs)
        else:
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

class DocumentShare(TenantModel, UserStampedModel):
    """
    Tracks which users OR projects have been directly granted access to a document.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="shares"
    )
    
    # Made null=True to allow project sharing instead
    shared_with = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shared_documents",
        null=True, 
        blank=True
    )
    
    # NEW: Link to a target Project
    shared_project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="shared_in_documents",
        null=True, 
        blank=True
    )

    class Meta:
        db_table = "document_shares"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=['document', 'shared_with'], name='unique_document_user_share'),
            models.UniqueConstraint(fields=['document', 'shared_project'], name='unique_document_project_share'),
        ]

    def __str__(self):
        if self.shared_project:
            return f"{self.document.name} shared with Project: {self.shared_project.name}"
        return f"{self.document.name} shared with {self.shared_with}"
    
    