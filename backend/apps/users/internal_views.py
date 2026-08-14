"""
apps/users/internal_views.py  (PM Backend)

Internal API endpoints for cross-product communication within Dyuksa.

ARCHITECTURE:
    PM and Central have SEPARATE databases.
    Central is the single identity provider — all auth goes through Central.
    PM stores its own User records mapped to Central via central_user_id field.

    JWT carries Central's user_id.
    PM resolves the local user via: User.objects.get(central_user_id=jwt_user_id)
    NOT: User.objects.get(id=jwt_user_id) ← WRONG — local id may differ

ENDPOINTS:
    GET  /api/v1/internal/users/?org_id=1
        Returns all active users for an organisation.

    POST /api/v1/internal/webhook/user-created/
        Called by Central when a new user is created and PM portal grant assigned.
        PM creates or updates its local user mirror with central_user_id set.
"""

import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.contrib.auth import get_user_model

User   = get_user_model()
logger = logging.getLogger(__name__)


class InternalTokenPermission:
    @staticmethod
    def is_valid(request):
        token    = request.headers.get("X-Internal-Token", "")
        expected = getattr(settings, "INTERNAL_API_TOKEN", "")
        if not expected:
            return False
        return token == expected


class InternalUserListView(APIView):
    """
    GET /api/v1/internal/users/?org_id=1
    Returns all active users for an organisation.
    """
    authentication_classes = []
    permission_classes     = []

    def get(self, request):
        if not InternalTokenPermission.is_valid(request):
            return Response(
                {"error": "Invalid or missing X-Internal-Token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        org_id = request.query_params.get("org_id")
        if not org_id:
            return Response(
                {"error": "org_id query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            org_id = int(org_id)
        except ValueError:
            return Response(
                {"error": "org_id must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users = User.objects.filter(
            organization_id = org_id,
            is_active       = True,
            is_superuser    = False,
        ).values(
            "id", "central_user_id", "email", "username",
            "first_name", "last_name", "role", "organization_id",
        ).order_by("id")

        return Response(list(users))


class UserCreatedWebhookView(APIView):
    """
    POST /api/v1/internal/webhook/user-created/

    Called by Central when a new user is created and PM portal grant assigned.

    HOW IT WORKS:
        1. Look up PM user by email — NOT by id
           (local id and Central id can differ — never force the id)
        2. If PM user exists → set central_user_id, ensure is_active=True
        3. If PM user does not exist → create new PM user with central_user_id set
        4. Ensure Organisation exists in PM DB (same id as Central)
        5. Ensure Workspace exists in PM DB
        6. Ensure WorkspaceMembership exists
        7. Assign pm_admin role in RoleAssignment

    WHY EMAIL LOOKUP (not id):
        Old PM users exist with local ids 1–100+.
        Central creates new users with different ids.
        The same person (same email) may exist in both DBs with different ids.
        Email is the stable unique identifier across both systems.

    Payload from Central:
        {
            "user_id":     95,       ← Central's user_id → set as central_user_id
            "email":       "admin@company.com",
            "username":    "company_admin",
            "first_name":  "Harshit",
            "last_name":   "Shukla",
            "org_id":      26,
            "org_name":    "Lerns",
            "org_slug":    "lerns",
        }
    """
    authentication_classes = []
    permission_classes     = []

    def post(self, request):
        if not InternalTokenPermission.is_valid(request):
            return Response(
                {"error": "Invalid or missing X-Internal-Token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        central_user_id = request.data.get("user_id")
        email           = request.data.get("email", "").strip().lower()
        username        = request.data.get("username", "").strip()
        first_name      = request.data.get("first_name", "")
        last_name       = request.data.get("last_name", "")
        org_id          = request.data.get("org_id")
        org_name        = request.data.get("org_name", "")
        org_slug        = request.data.get("org_slug", "")

        if not central_user_id or not org_id or not email:
            return Response(
                {"error": "user_id, org_id, and email are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from django.utils import timezone
            from django.db import transaction
            from apps.organizations.models import (
                Organization, Workspace, WorkspaceMembership
            )
            from apps.rbac.models import Role, RoleAssignment

            today = timezone.now().date()

            with transaction.atomic():

                # ── Step 1: Get or create Org in PM DB ────────────────────
                org, org_created = Organization.objects.get_or_create(
                    id       = org_id,
                    defaults = {
                        "name":      org_name or f"Org {org_id}",
                        "slug":      org_slug or f"org-{org_id}",
                        "is_active": True,
                    },
                )
                if org_created:
                    logger.info("PM: Created org id=%s name=%s", org_id, org.name)
                else:
                    # Update org name if it was created with a fallback name
                    # This fixes orgs created before org_name was in the payload
                    changed = False
                    if org_name and org.name == f"Org {org_id}":
                        org.name = org_name
                        changed = True
                    if org_slug and org.slug == f"org-{org_id}":
                        org.slug = org_slug
                        changed = True
                    if not org.is_active:
                        org.is_active = True
                        changed = True
                    if changed:
                        org.save()
                        logger.info(
                            "PM: Updated org id=%s name=%s", org_id, org.name
                        )

                # ── Step 2: Get or create Workspace in PM DB ───────────────
                workspace = Workspace.objects.filter(
                    organization=org, is_default=True
                ).first()

                if not workspace:
                    workspace = Workspace.objects.create(
                        organization = org,
                        name         = org.name,
                        is_default   = True,
                        is_active    = True,
                    )
                    logger.info(
                        "PM: Created workspace id=%s org=%s",
                        workspace.id, org_id,
                    )

                # ── Step 3: Get or create PM user ──────────────────────────
                # LOOKUP BY EMAIL — not by id
                # Old PM users with same email should be reused, not duplicated
                pm_user = User.objects.filter(email__iexact=email).first()
                user_created_now = False

                if pm_user:
                    # Update central_user_id and ensure active
                    changed = False
                    if pm_user.central_user_id != int(central_user_id):
                        pm_user.central_user_id = central_user_id
                        changed = True
                    if not pm_user.is_active:
                        pm_user.is_active = True
                        changed = True
                    if pm_user.organization_id != int(org_id):
                        pm_user.organization = org
                        changed = True
                    if first_name and pm_user.first_name != first_name:
                        pm_user.first_name = first_name
                        changed = True
                    if last_name and pm_user.last_name != last_name:
                        pm_user.last_name = last_name
                        changed = True
                    if changed:
                        pm_user.save()
                        logger.info(
                            "PM: Updated user pm_id=%s central_id=%s email=%s",
                            pm_user.id, central_user_id, email,
                        )
                else:
                    # Brand new user — create with PM auto-increment id
                    # central_user_id is stored for JWT resolution
                    safe_username = username or email.split("@")[0]
                    counter = 1
                    while User.objects.filter(username=safe_username).exists():
                        safe_username = f"{safe_username}_{counter}"
                        counter += 1

                    pm_user = User(
                        email           = email,
                        username        = safe_username,
                        first_name      = first_name,
                        last_name       = last_name,
                        organization    = org,
                        is_active       = True,
                        role            = "admin",
                        central_user_id = central_user_id,
                    )
                    # Unusable password — all auth goes through Central JWT
                    pm_user.set_unusable_password()
                    pm_user.save()
                    user_created_now = True
                    logger.info(
                        "PM: Created user pm_id=%s central_id=%s email=%s org=%s",
                        pm_user.id, central_user_id, email, org_id,
                    )

                # ── Step 4: Create WorkspaceMembership ─────────────────────
                _, mem_created = WorkspaceMembership.objects.get_or_create(
                    user      = pm_user,
                    workspace = workspace,
                    defaults  = {"role": "admin"},
                )

                # ── Step 5: Assign pm_admin role ───────────────────────────
                role_code = None
                pm_role = Role.objects.filter(
                    tenant_id = None,
                    code      = "pm_admin",
                    platform  = "pm",
                ).first()

                if not pm_role:
                    pm_role = Role.objects.filter(
                        tenant_id = None,
                        code      = "workspace_member",
                        platform  = "pm",
                    ).first()
                    if pm_role:
                        role_code = "workspace_member"
                else:
                    role_code = "pm_admin"

                if pm_role:
                    RoleAssignment.objects.get_or_create(
                        user_id    = pm_user.id,
                        role       = pm_role,
                        platform   = "pm",
                        scope_type = "organization",
                        scope_id   = org_id,
                        defaults   = {
                            "valid_from":  today,
                            "valid_to":    None,
                            "assigned_by": None,
                        },
                    )

            return Response({
                "status":           "created" if user_created_now else "updated",
                "pm_user_id":       pm_user.id,
                "central_user_id":  central_user_id,
                "org_id":           org_id,
                "workspace_id":     workspace.id,
                "role":             role_code,
            })

        except Exception as e:
            logger.error(
                "PM: Webhook failed for central_user_id=%s: %s",
                central_user_id, e,
            )
            import traceback
            logger.error(traceback.format_exc())
            return Response(
                {"error": f"Provisioning failed: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )