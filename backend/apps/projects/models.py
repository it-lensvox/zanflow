"""
Project management models for ZanFlow.
"""
from django.conf import settings as django_settings
from django.db import models
from core.models import UserStampedModel
from apps.organizations.models import TenantModel


class Project(TenantModel, UserStampedModel):
    """
    Project containing documents, ground truth, and test runs.

    Inherits from:
      - TenantModel  → adds `organization` FK + auto-filtered `objects` manager
      - UserStampedModel → adds `created_by`, `updated_by`, timestamps
    """

    class TaskType(models.TextChoices):
        Client = "client", "Client"
        Internal = "internal", "Internal"
        CONTENT_CREATION = "content_creation", "Content Creation"
        Ideas = "ideas", "Ideas"
        Demo = "demo", "Demo" 
    
    # ADD THIS: Status choices mapped exactly to the frontend requirements
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        IN_REVIEW = "in_review", "In Review"
        DRAFT = "draft", "Draft"
        ARCHIVED = "archived", "Archived"
        COMPLETED = "completed", "Completed"
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    task_type = models.CharField(
        max_length=50,
        choices=TaskType.choices,
        default=TaskType.Client,
    )
    favorited_by = models.ManyToManyField(
        django_settings.AUTH_USER_MODEL,
        related_name="favorite_projects",
        blank=True
    )    
    project_settings = models.JSONField(default=dict, blank=True)
    default_labels = models.JSONField(default=list, blank=True)
    default_assignees = models.ManyToManyField(
        django_settings.AUTH_USER_MODEL,
        related_name="assigned_projects",
        blank=True,
    )
    members = models.ManyToManyField(
        django_settings.AUTH_USER_MODEL,
        through="ProjectMembership",
        related_name="projects",
    )
    
    # REMOVE THIS:
    # is_active = models.BooleanField(default=True)
    
    # ADD THIS:
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    
    class Meta:
        db_table = "projects"
        ordering = ["-created_at"]
    
    def __str__(self):
        return self.name

class ProjectMembership(models.Model):
    """
    Project membership with role-based access.
    NOTE: Not tenant-scoped directly — scoped implicitly via the Project FK.
    """
    
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        FRONTEND = "frontend", "Frontend Developer"
        BACKEND = "backend", "Backend Developer"
        TESTER = "tester", "Testing Engineer"
        DEVOPS = "devops", "DevOps Engineer"
        SOCIAL_MEDIA = "social_media", "Social Media"
        VIEWER = "viewer", "Viewer"
        MEMBER = "member", "Member" 
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    role = models.CharField(
        max_length=20, 
        choices=Role.choices, 
        default=Role.VIEWER
    )
    
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "project_memberships"
        unique_together = ["project", "user"]
    
    def __str__(self):
        return f"{self.user} - {self.project} ({self.role})"


class Label(TenantModel, UserStampedModel):
    """
    Labels for categorizing documents, issues, etc.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="labels",
    )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#6366f1")  # Hex color
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    
    class Meta:
        db_table = "labels"
        unique_together = ["project", "name"]
        ordering = ["name"]
    
    def __str__(self):
        return f"{self.name} ({self.project.name})"
