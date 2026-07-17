"""
Tenant onboarding service for ZanFlow.

Industry-standard approach: All tenant lifecycle operations go through
a service layer — never directly through ORM calls in views or commands.
This ensures consistency, auditability, and a single source of truth.
"""

from __future__ import annotations

import logging
import secrets
from typing import TYPE_CHECKING, Optional

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.organizations.models import Organization, Workspace, WorkspaceMembership

if TYPE_CHECKING:
    from apps.users.models import User

logger = logging.getLogger(__name__)

# Default RBAC role assigned per product when a new employee is added.
# HR Admin can upgrade these later via POST /api/v1/rbac/assignments/
_DEFAULT_PRODUCT_ROLES = {
    "hrms": "employee",
    "pm":   "project_viewer",
    "crm":  "support_agent",
}


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

        # Create the first user as a tenant admin (NOT superuser)
        # Superuser is reserved ONLY for the platform owner (Production Team)
        # Tenant admins have full power within their org but cannot access
        # other tenants or platform-level endpoints like /overview/
        admin_user = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=admin_password,
            organization=org,
        )
        admin_user.role = "admin"
        admin_user.is_staff = True
        admin_user.save(update_fields=["role", "is_staff"])
        # Create the default workspace
        default_ws = Workspace.objects.create(
            organization=org,
            name=name,
            is_default=True,
            created_by=admin_user,
        )
        WorkspaceMembership.objects.create(
            user=admin_user,
            workspace=default_ws,
            role="admin",
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


# ─────────────────────────────────────────────────────────────────────────────
# PLATFORM ONBOARDING
#
# These methods belong to the Central System — not to any single product.
# When the Dyuksa codebase is separated into individual services, move this
# entire class to the Central System project.
#
# Search tag to find everything that moves:  PLATFORM_SEPARATION
# ─────────────────────────────────────────────────────────────────────────────

class EmployeeOnboardingService:  # PLATFORM_SEPARATION
    """
    Single entry point for adding any new person to Dyuksa.

    Responsibilities:
        1. Validate the products the org is licensed to use
        2. Create the user account (or send an invite)
        3. Assign default RBAC role per product (employee in HRMS, viewer in PM)
        4. Send welcome email listing their product access
        5. On exit — revoke all product access in one operation

    Industry pattern:
        Google Workspace  — Admin Console provisions users, products receive them
        Zoho One          — Zoho People provisions users, all apps receive them
        Atlassian Access  — Atlassian Admin provisions users, Jira/Confluence receive them
        Dyuksa Platform   — This service provisions users, PM/HRMS/CRM receive them
    """

    # ─────────────────────────────────────────────────────────────────
    # 1. INVITE — async, employee sets up their own account
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def invite_employee(
        invited_by,
        email: str,
        products: list,
        role: str = "annotator",
        workspace_id: Optional[int] = None,
        designation: Optional[str] = None,
        department_id: Optional[int] = None,
    ) -> dict:
        """
        Send a product-aware invite email to a new employee.

        Validates org license, creates Invitation row (existing model),
        sends email with product list and invite link.

        On acceptance AcceptInvitationView calls on_invite_accepted()
        which assigns the RBAC roles automatically.
        """
        from apps.users.models import Invitation
        from datetime import timedelta
        from django.conf import settings

        org = invited_by.organization
        if not org:
            raise ValueError("Inviting user has no organisation.")

        # Validate products against org license
        licensed = EmployeeOnboardingService._get_licensed_products(org)
        invalid  = [p for p in products if p not in licensed]
        if invalid:
            raise ValueError(
                f"Products {invalid} are not licensed for {org.name}. "
                f"Licensed: {licensed}"
            )

        if EmployeeOnboardingService._user_exists(email, org):
            raise ValueError(f"{email} is already a member of {org.name}.")

        # Resolve workspace (existing logic — unchanged)
        workspace = None
        if workspace_id:
            workspace = Workspace.objects.filter(
                id=workspace_id,
                organization=org,
                is_active=True,
            ).first()
        if not workspace:
            workspace = Workspace.objects.filter(
                organization=org,
                is_default=True,
            ).first()

        # Create Invitation row — same model your existing SendInvitationView uses
        invitation = Invitation.objects.create(
            email        = email,
            role         = role,
            organization = org,
            workspace    = workspace,
        )

        # Build invite link — carry products as query param so
        # AcceptInvitationView can read them on acceptance
        frontend_url = getattr(settings, "FRONTEND_URL", "https://app.dyuksa.com")
        product_str  = ",".join(products)
        invite_link  = (
            f"{frontend_url}/setup-account"
            f"?token={invitation.token}"
            f"&products={product_str}"
        )
        if designation:
            invite_link += f"&designation={designation}"
        if department_id:
            invite_link += f"&department_id={department_id}"

        # Send email
        EmployeeOnboardingService._send_invite_email(
            to_email   = email,
            invited_by = invited_by,
            org_name   = org.name,
            products   = products,
            invite_link = invite_link,
        )

        logger.info(
            "platform: invite sent email=%s org=%s products=%s by=%s",
            email, org.name, products, invited_by.email,
        )

        return {
            "token":       invitation.token,
            "email":       email,
            "products":    products,
            "expires_at":  invitation.expires_at.isoformat(),
            "invite_link": invite_link,
        }

    # ─────────────────────────────────────────────────────────────────
    # 2. CREATE — sync, HR Admin fills full profile directly
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def create_employee(
        created_by,
        first_name: str,
        last_name: str,
        email: str,
        products: list,
        password: str,                        # HR Admin sets the real password
        role: str = "annotator",
        product_roles: Optional[dict] = None, # e.g. {"hrms": "hr_admin", "pm": "project_viewer"}
        designation: Optional[str] = None,
        department_id: Optional[int] = None,
        workspace_id: Optional[int] = None,
        send_welcome_email: bool = True,
    ) -> dict:
        """
        Create a new employee account immediately.

        Creates the user with a real password set by HR Admin.
        Assigns RBAC roles per product — uses product_roles if provided,
        otherwise falls back to the default lowest role per product.
        Sends a welcome email listing their product access.
        """
        User = get_user_model()
        org  = created_by.organization

        if not org:
            raise ValueError("Creating user has no organisation.")

        # Validate
        licensed = EmployeeOnboardingService._get_licensed_products(org)
        invalid  = [p for p in products if p not in licensed]
        if invalid:
            raise ValueError(
                f"Products {invalid} are not licensed for {org.name}. "
                f"Licensed: {licensed}"
            )

        if User.objects.filter(email=email).exists():
            raise ValueError(f"A user with email {email} already exists.")

        # Generate unique username from email
        base     = email.split("@")[0].lower().replace(".", "_")
        username = base
        n        = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}_{n}"
            n       += 1

        # Create user with the real password HR Admin provided
        user = User.objects.create_user(
            username     = username,
            email        = email,
            password     = password,
            first_name   = first_name,
            last_name    = last_name,
            role         = role,
            organization = org,
        )

        # Add to workspace
        workspace = None
        if workspace_id:
            workspace = Workspace.objects.filter(
                id=workspace_id, organization=org
            ).first()
        if not workspace:
            workspace = Workspace.objects.filter(
                organization=org, is_default=True
            ).first()
        if workspace:
            WorkspaceMembership.objects.get_or_create(
                user=user, workspace=workspace,
                defaults={"role": role},
            )

        # Assign RBAC roles per product
        # product_roles overrides the default per product if provided
        assigned_roles = EmployeeOnboardingService._assign_product_roles(
            user          = user,
            products      = products,
            org           = org,
            product_roles = product_roles,
            department_id = department_id,
            assigned_by   = created_by,
        )

        # Send welcome email — no password in email since HR set it directly
        if send_welcome_email:
            EmployeeOnboardingService._send_welcome_email(
                user     = user,
                org_name = org.name,
                products = products,
            )

        logger.info(
            "platform: employee created email=%s org=%s products=%s roles=%s by=%s",
            email, org.name, products, assigned_roles, created_by.email,
        )

        return {
            "user_id":        user.pk,
            "email":          user.email,
            "username":       user.username,
            "full_name":      f"{first_name} {last_name}".strip(),
            "organisation":   org.name,
            "products":       products,
            "assigned_roles": assigned_roles,
        }

    # ─────────────────────────────────────────────────────────────────
    # 3. ON INVITE ACCEPTED — called from AcceptInvitationView
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def on_invite_accepted(
        user,
        products: list,
        department_id: Optional[int] = None,
    ) -> dict:
        """
        Called after a user accepts their invite and sets up their account.
        Assigns RBAC roles for all products in the invite link.

        Called from AcceptInvitationView.post() — 3 lines added there.
        Nothing else in AcceptInvitationView changes.
        """
        org = user.organization
        if not org or not products:
            return {}

        assigned_roles = EmployeeOnboardingService._assign_product_roles(
            user          = user,
            products      = products,
            org           = org,
            department_id = department_id,
            assigned_by   = None,  # self-provisioned via invite link
        )

        logger.info(
            "platform: invite accepted user=%s products=%s roles=%s",
            user.email, products, assigned_roles,
        )

        return assigned_roles

    # ─────────────────────────────────────────────────────────────────
    # 4. OFFBOARD — revoke all product access on last working day
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def offboard_employee(
        user,
        last_working_day: str,
        offboarded_by,
    ) -> dict:
        """
        Revokes all RoleAssignment rows across ALL platforms on last working day.

        One call covers PM, HRMS, and CRM simultaneously.
        No manual cleanup needed per product.

        Sets user.is_active = False if last_working_day is today or past.
        """
        from apps.rbac.models import RoleAssignment
        from django.db.models import Q

        today    = timezone.now().date()
        last_day = timezone.datetime.strptime(
            last_working_day, "%Y-%m-%d"
        ).date()

        # Expire all active assignments
        revoked = RoleAssignment.objects.filter(
            user_id         = user.pk,
            valid_from__lte = today,
        ).filter(
            Q(valid_to__isnull=True) | Q(valid_to__gte=today)
        ).update(valid_to=last_day)

        # Deactivate account if last day is today or past
        if last_day <= today:
            user.is_active = False
            user.save(update_fields=["is_active"])

        logger.info(
            "platform: offboarding user=%s last_day=%s revoked=%s by=%s",
            user.email, last_working_day, revoked, offboarded_by.email,
        )

        return {
            "user_id":             user.pk,
            "email":               user.email,
            "last_working_day":    last_working_day,
            "assignments_revoked": revoked,
            "message": (
                f"All product access for {user.email} will expire on "
                f"{last_working_day}. {revoked} assignment(s) updated."
            ),
        }

    # ─────────────────────────────────────────────────────────────────
    # INTERNAL HELPERS
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _get_licensed_products(org) -> list:
        """Returns product keys the org is licensed to use."""
        from apps.organizations.models import PlatformAccess
        return list(
            PlatformAccess.objects.filter(
                organization        = org,
                is_active           = True,
                platform__is_active = True,
            ).values_list("platform__key", flat=True)
        )

    @staticmethod
    def _user_exists(email: str, org) -> bool:
        User = get_user_model()
        return User.objects.filter(email=email, organization=org).exists()

    @staticmethod
    def _assign_product_roles(
        user, products: list, org,
        department_id: Optional[int],
        assigned_by,
        product_roles: Optional[dict] = None,
    ) -> dict:
        """
        Assigns RBAC role for each product.
        Uses product_roles[product] if provided, else falls back to
        _DEFAULT_PRODUCT_ROLES (lowest role for that product).
        Revokes any existing active role on the same platform first.
        """
        from apps.rbac.models import Role, RoleAssignment
        from django.db.models import Q

        today    = timezone.now().date()
        assigned = {}

        for product in products:
            # Use override role if provided, else use default lowest role
            role_code = (product_roles or {}).get(product) or _DEFAULT_PRODUCT_ROLES.get(product)
            if not role_code:
                logger.warning("platform: no default role for product=%s", product)
                continue

            role = Role.objects.filter(
                tenant_id = None,
                code      = role_code,
                platform__in = [product, "all"],
            ).first()

            if not role:
                logger.warning(
                    "platform: role not found code=%s platform=%s "
                    "— run seed commands first",
                    role_code, product,
                )
                continue

            # Scope
            if product == "hrms" and department_id:
                scope_type = "department"
                scope_id   = department_id
            else:
                scope_type = "organization"
                scope_id   = org.pk

            # Revoke existing active role on this platform
            RoleAssignment.objects.filter(
                user_id         = user.pk,
                platform        = product,
                valid_from__lte = today,
            ).filter(
                Q(valid_to__isnull=True) | Q(valid_to__gte=today)
            ).update(valid_to=today)

            # Assign new role
            RoleAssignment.objects.get_or_create(
                user_id    = user.pk,
                role       = role,
                platform   = product,
                scope_type = scope_type,
                scope_id   = scope_id,
                defaults   = {
                    "valid_from":  today,
                    "valid_to":    None,
                    "assigned_by": assigned_by,
                },
            )

            assigned[product] = role_code

        return assigned

    @staticmethod
    def _send_invite_email(to_email, invited_by, org_name, products, invite_link):
        from django.core.mail import send_mail
        from django.conf import settings

        names = {
            "hrms": "Human Resources (HRMS)",
            "pm":   "Project Management (PM)",
            "crm":  "Customer Relations (CRM)",
        }
        product_list = "\n".join(f"  • {names.get(p, p.upper())}" for p in products)

        body = (
            f"Hi,\n\n"
            f"{invited_by.get_full_name() or invited_by.email} has invited you "
            f"to join {org_name} on Dyuksa.\n\n"
            f"You will have access to:\n{product_list}\n\n"
            f"Set up your account here:\n{invite_link}\n\n"
            f"This link expires in 48 hours.\n\n"
            f"— The Dyuksa Team"
        )

        try:
            send_mail(
                subject        = f"You have been invited to join {org_name} on Dyuksa",
                message        = body,
                from_email     = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@dyuksa.com"),
                recipient_list = [to_email],
                fail_silently  = False,
            )
        except Exception as e:
            logger.error("platform: invite email failed to=%s: %s", to_email, e)

    @staticmethod
    def _send_welcome_email(user, org_name, products):
        from django.core.mail import send_mail
        from django.conf import settings

        names = {
            "hrms": "Human Resources (HRMS)",
            "pm":   "Project Management (PM)",
            "crm":  "Customer Relations (CRM)",
        }
        product_list = "\n".join(f"  • {names.get(p, p.upper())}" for p in products)

        body = (
            f"Hi {user.first_name or user.username},\n\n"
            f"Welcome to {org_name}! Your Dyuksa account has been created.\n\n"
            f"Email:    {user.email}\n\n"
            f"You can log in at: https://app.dyuksa.com\n\n"
            f"You have access to:\n{product_list}\n\n"
            f"— The Dyuksa Team"
        )

        try:
            send_mail(
                subject        = f"Welcome to {org_name} on Dyuksa",
                message        = body,
                from_email     = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@dyuksa.com"),
                recipient_list = [user.email],
                fail_silently  = False,
            )
        except Exception as e:
            logger.error("platform: welcome email failed to=%s: %s", user.email, e)