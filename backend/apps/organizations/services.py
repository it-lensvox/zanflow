"""
Tenant onboarding service for ZanFlow.

Industry-standard approach: All tenant lifecycle operations go through
a service layer — never directly through ORM calls in views or commands.
This ensures consistency, auditability, and a single source of truth.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.organizations.models import Organization

if TYPE_CHECKING:
    from apps.users.models import User

logger = logging.getLogger(__name__)


class TenantOnboardingService:
    """
    Handles the full tenant lifecycle:
      - Provisioning (create org + admin user)
      - User invitation / assignment
      - Deactivation / offboarding

    Why a service layer?
      1. Single place for all business logic — views, commands, APIs all call this.
      2. Easy to add hooks: billing, email notifications, audit logs.
      3. Testable in isolation.
    """

    # ─────────────────────────────────────────────────────────────────
    # 1. PROVISION A NEW TENANT
    # ─────────────────────────────────────────────────────────────────
    @staticmethod
    @transaction.atomic
    def create_tenant(
        name: str,
        admin_username: str,
        admin_email: str,
        admin_password: str,
        slug: Optional[str] = None,
    ) -> dict:
        """
        Create a new organization and its first admin user in one atomic operation.

        Returns:
            dict with 'organization' and 'admin_user' keys.

        Raises:
            ValueError: If org name or admin email already exists.
        """
        User = get_user_model()

        # Validate uniqueness
        if Organization.objects.filter(name=name).exists():
            raise ValueError(f"Organization '{name}' already exists.")
        if User.objects.filter(email=admin_email).exists():
            raise ValueError(f"User with email '{admin_email}' already exists.")

        # Create organization
        org = Organization.objects.create(
            name=name,
            slug=slug,  # auto-generated in model.save() if None
        )

        # Create the first user as a superuser with full power
        # This user can then add/manage all other members via the app
        admin_user = User.objects.create_superuser(
            username=admin_username,
            email=admin_email,
            password=admin_password,
            organization=org,
        )

        logger.info(
            "Tenant provisioned: org=%s (ID=%s), admin=%s",
            org.name, org.id, admin_user.username,
        )

        return {
            "organization": org,
            "admin_user": admin_user,
        }

    # ─────────────────────────────────────────────────────────────────
    # 2. ADD USER TO AN EXISTING TENANT
    # ─────────────────────────────────────────────────────────────────
    @staticmethod
    @transaction.atomic
    def add_user_to_tenant(
        organization_id: int,
        username: str,
        email: str,
        password: str,
        role: str = "annotator",
    ) -> User:
        """
        Create a new user and assign them to an existing organization.
        """
        User = get_user_model()
        org = Organization.objects.get(id=organization_id)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            organization=org,
        )

        logger.info(
            "User added to tenant: user=%s, org=%s (ID=%s)",
            user.username, org.name, org.id,
        )

        return user

    # ─────────────────────────────────────────────────────────────────
    # 3. MOVE USER BETWEEN TENANTS
    # ─────────────────────────────────────────────────────────────────
    @staticmethod
    @transaction.atomic
    def transfer_user(user_id: int, new_organization_id: int) -> User:
        """
        Transfer a user from one organization to another.
        Use with caution — the user's data in the old org remains there.
        """
        User = get_user_model()
        user = User.objects.get(id=user_id)
        old_org = user.organization
        new_org = Organization.objects.get(id=new_organization_id)

        user.organization = new_org
        user.save(update_fields=["organization"])

        logger.info(
            "User transferred: user=%s, from=%s → to=%s",
            user.username,
            old_org.name if old_org else "None",
            new_org.name,
        )

        return user

    # ─────────────────────────────────────────────────────────────────
    # 4. DEACTIVATE A TENANT
    # ─────────────────────────────────────────────────────────────────
    @staticmethod
    @transaction.atomic
    def deactivate_tenant(organization_id: int) -> Organization:
        """
        Soft-deactivate a tenant. Users can no longer log in and see data,
        but nothing is deleted.
        """
        org = Organization.objects.get(id=organization_id)
        org.is_active = False
        org.save(update_fields=["is_active", "updated_at"])

        # Deactivate all users in this org
        User = get_user_model()
        deactivated_count = User.objects.filter(
            organization=org
        ).update(is_active=False)

        logger.info(
            "Tenant deactivated: org=%s (ID=%s), %d users deactivated",
            org.name, org.id, deactivated_count,
        )

        return org

    # ─────────────────────────────────────────────────────────────────
    # 5. REACTIVATE A TENANT
    # ─────────────────────────────────────────────────────────────────
    @staticmethod
    @transaction.atomic
    def reactivate_tenant(organization_id: int) -> Organization:
        """Reactivate a previously deactivated tenant."""
        org = Organization.objects.get(id=organization_id)
        org.is_active = True
        org.save(update_fields=["is_active", "updated_at"])

        User = get_user_model()
        reactivated_count = User.objects.filter(
            organization=org
        ).update(is_active=True)

        logger.info(
            "Tenant reactivated: org=%s (ID=%s), %d users reactivated",
            org.name, org.id, reactivated_count,
        )

        return org

    # ─────────────────────────────────────────────────────────────────
    # 6. GET TENANT STATS
    # ─────────────────────────────────────────────────────────────────
    @staticmethod
    def get_tenant_stats(organization_id: int) -> dict:
        """Return a summary of a tenant's data for admin dashboards."""
        from apps.projects.models import Project
        from apps.tasksite.models import Task
        from apps.chat.models import ChatRoom, ChatMessage
        from apps.teams.models import Team

        org = Organization.objects.get(id=organization_id)
        User = get_user_model()

        return {
            "organization": org.name,
            "is_active": org.is_active,
            "users": User.objects.filter(organization=org).count(),
            "projects": Project.original_objects.filter(organization=org).count(),
            "tasks": Task.original_objects.filter(organization=org).count(),
            "teams": Team.original_objects.filter(organization=org).count(),
            "chat_rooms": ChatRoom.original_objects.filter(organization=org).count(),
            "chat_messages": ChatMessage.original_objects.filter(organization=org).count(),
        }

    # ─────────────────────────────────────────────────────────────────
    # 7. DELETE A TENANT (PERMANENT)
    # ─────────────────────────────────────────────────────────────────
    @staticmethod
    @transaction.atomic
    def delete_tenant(organization_id: int) -> dict:
        """
        Permanently delete a tenant and ALL its data.
        This is irreversible — use deactivate_tenant for soft removal.

        Deletes in order:
          1. All tenant-scoped model records
          2. All users in this org
          3. The organization itself

        Returns:
            dict with deletion summary.
        """
        from django.apps import apps
        from apps.organizations.models import TenantModel

        User = get_user_model()
        org = Organization.objects.get(id=organization_id)
        summary = {"organization": org.name, "deleted": {}}

        # Delete all TenantModel records for this org
        tenant_models = []
        for model in apps.get_models():
            if (
                issubclass(model, TenantModel)
                and not model._meta.abstract
                and model is not TenantModel
            ):
                tenant_models.append(model)

        for model in tenant_models:
            label = f"{model._meta.app_label}.{model.__name__}"
            count, _ = model.original_objects.filter(organization=org).delete()
            summary["deleted"][label] = count

        # Delete all users in this org
        user_count, _ = User.objects.filter(organization=org).delete()
        summary["deleted"]["users"] = user_count

        # Delete the organization itself
        org.delete()

        logger.info(
            "Tenant permanently deleted: %s (ID=%s) — %s",
            summary["organization"],
            organization_id,
            summary["deleted"],
        )

        return summary