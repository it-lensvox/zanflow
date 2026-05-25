"""
Multi-tenant models for ZanFlow.

This module defines:
  - Organization: The tenant entity.
  - TenantManager: A custom manager that auto-filters querysets by the current tenant.
  - TenantModel: An abstract base class for all tenant-scoped models.
"""

import uuid
from django.db import models
from django.utils.text import slugify

from .context import get_current_organization
from django.conf import settings

# ---------------------------------------------------------------------------
# Organization (the tenant)
# ---------------------------------------------------------------------------

class Organization(models.Model):
    """
    Represents a tenant / team / workspace in the system.
    Every piece of tenant-scoped data will have a FK back to this model.
    """

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
# TenantManager – auto-filters by current organization
# ---------------------------------------------------------------------------

class TenantManager(models.Manager):
    """
    A custom manager that transparently scopes every queryset to the
    organization stored in the thread-local context.

    If no organization is set (e.g. management commands, migrations,
    superuser admin), the queryset is returned **unfiltered** so that
    the system doesn't break.
    """

    def get_queryset(self) -> models.QuerySet:
        qs = super().get_queryset()
        organization_id = get_current_organization()
        if organization_id is not None:
            qs = qs.filter(organization_id=organization_id)
        return qs


# ---------------------------------------------------------------------------
# TenantModel – abstract base for all tenant-scoped models
# ---------------------------------------------------------------------------

class TenantModel(models.Model):
    """
    Abstract model that adds multi-tenant support to any Django model.

    Inherit from this instead of `models.Model` to automatically:
      1. Add an `organization` foreign key.
      2. Scope all default queries to the current tenant via `TenantManager`.
      3. Auto-set the `organization` on save if not already set.

    Two managers are provided:
      - `objects`          → TenantManager (filtered)
      - `original_objects` → default Django Manager (unfiltered, for migrations / admin)
    """

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        null=True,      # nullable initially to support existing data migration
        blank=True,
        db_index=True,
    )

    # Filtered manager (default)
    objects = TenantManager()

    # Unfiltered manager for migrations, management commands, superuser tasks
    original_objects = models.Manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Auto-assign the current organization if not explicitly set."""
        if self.organization_id is None:
            org_id = get_current_organization()
            if org_id is not None:
                self.organization_id = org_id
        super().save(*args, **kwargs)

class OrganizationMember(models.Model):
    """
    Bridge table connecting a User to an Organization.
    This replaces the direct ForeignKey on the User model.
    """
    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("manager", "Manager"),
        ("annotator", "Annotator"), # Or whatever your base roles are
    )

    organization = models.ForeignKey(
        "organizations.Organization", 
        on_delete=models.CASCADE, 
        related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="workspace_memberships"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="annotator")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # A user can only have one membership record per organization
        unique_together = ("organization", "user")
        verbose_name = "Organization Member"
        verbose_name_plural = "Organization Members"

    def __str__(self):
        return f"{self.user.username} - {self.organization.name} ({self.role})"
