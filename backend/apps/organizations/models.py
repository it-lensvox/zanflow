"""
Multi-tenant models for ZanFlow.

This module defines:
  - Organization: The tenant entity.
  - Workspace: A sub-division within an organization for data isolation.
  - WorkspaceMembership: Links users to workspaces with roles.
  - TenantManager: A custom manager that auto-filters querysets by org + workspace.
  - TenantModel: An abstract base class for all tenant-scoped models.
"""

import uuid
from django.db import models
from django.utils.text import slugify

from .context import get_current_organization, get_current_workspace


def _get_current_request():
    """
    Get the current request from the middleware thread-local.
    This is the fallback when ASGI/Daphne runs the view on a different
    thread than where authentication set the thread-local context.
    """
    try:
        from django.middleware.common import CommonMiddleware
        import threading
        # Try to get request from the current thread's locals
        # This won't work, so we use a different approach below
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Organization (the tenant)
# ---------------------------------------------------------------------------

class Organization(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

class Workspace(models.Model):
    id = models.AutoField(primary_key=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="workspaces",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, blank=True)
    description = models.TextField(blank=True, default="")
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_workspaces",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "slug")
        ordering = ["-is_default", "name"]
        verbose_name = "Workspace"
        verbose_name_plural = "Workspaces"

    def __str__(self) -> str:
        return f"{self.name} ({self.organization.name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while Workspace.objects.filter(
                organization=self.organization, slug=slug
            ).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# WorkspaceMembership
# ---------------------------------------------------------------------------

class WorkspaceMembership(models.Model):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("manager", "Manager"),
        ("developer", "Developer"),    
        ("annotator", "Annotator"),    
        ("viewer", "Viewer"), 
    ]

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="workspace_memberships",
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "workspace")
        verbose_name = "Workspace Membership"
        verbose_name_plural = "Workspace Memberships"

    def __str__(self) -> str:
        return f"{self.user.username} → {self.workspace.name} ({self.role})"


# ---------------------------------------------------------------------------
# RequestContextStore — stores request per-thread for ASGI compatibility
# ---------------------------------------------------------------------------

import threading

_request_store = threading.local()


def set_current_request(request):
    """Store the current request in thread-local (called from middleware)."""
    _request_store.request = request


def get_current_request():
    """Retrieve the current request from thread-local."""
    return getattr(_request_store, 'request', None)


def clear_current_request():
    """Clear the request from thread-local."""
    _request_store.request = None


# ---------------------------------------------------------------------------
# TenantManager – auto-filters by org + workspace
# ---------------------------------------------------------------------------

class TenantManager(models.Manager):
    """
    Custom manager that scopes queries to the current org + workspace.

    Checks THREE sources for context (in order):
      1. Thread-local context (set by authentication classes)
      2. request.organization_id / request.workspace_id (set by auth, stored on request)
      3. No context found → return unfiltered (for shell, migrations, etc.)
    """

    def get_queryset(self) -> models.QuerySet:
        qs = super().get_queryset()

        # Try thread-local first
        organization_id = get_current_organization()
        workspace_id = get_current_workspace()

        # Fallback: check request object (for ASGI thread mismatch)
        if organization_id is None or workspace_id is None:
            request = get_current_request()
            if request is not None:
                if organization_id is None:
                    organization_id = getattr(request, 'organization_id', None)
                if workspace_id is None:
                    workspace_id = getattr(request, 'workspace_id', None)

        if organization_id is not None:
            qs = qs.filter(organization_id=organization_id)

        if workspace_id is not None:
            qs = qs.filter(workspace_id=workspace_id)

        return qs


# ---------------------------------------------------------------------------
# TenantModel – abstract base for all tenant-scoped models
# ---------------------------------------------------------------------------

class TenantModel(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        null=True,
        blank=True,
        db_index=True,
    )

    workspace = models.ForeignKey(
        "organizations.Workspace",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        null=True,
        blank=True,
        db_index=True,
    )

    # Filtered manager (default)
    objects = TenantManager()

    # Unfiltered manager
    original_objects = models.Manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.organization_id is None:
            org_id = get_current_organization()
            # Fallback to request
            if org_id is None:
                request = get_current_request()
                if request is not None:
                    org_id = getattr(request, 'organization_id', None)
            if org_id is not None:
                self.organization_id = org_id

        if self.workspace_id is None:
            ws_id = get_current_workspace()
            # Fallback to request
            if ws_id is None:
                request = get_current_request()
                if request is not None:
                    ws_id = getattr(request, 'workspace_id', None)
            if ws_id is not None:
                self.workspace_id = ws_id

        super().save(*args, **kwargs)
