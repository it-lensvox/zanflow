"""
apps/rbac/views.py

Phase A RBAC API views.

Endpoints:
    GET  /api/v1/rbac/assignments/        — list current user's active assignments
    POST /api/v1/rbac/assignments/        — assign a role to a user (Org Admin only)
    DELETE /api/v1/rbac/assignments/<id>/ — revoke an assignment (Org Admin only)
    GET  /api/v1/rbac/roles/              — list available roles for a platform
"""

import logging
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.rbac.models import Role, RoleAssignment, SodRule

logger = logging.getLogger(__name__)
User = get_user_model()


# ─────────────────────────────────────────────────────────────────────
# Permission helper
# ─────────────────────────────────────────────────────────────────────

def _is_org_admin(user) -> bool:
    """
    Returns True if the user holds Owner or Org Admin platform role.
    Checks both the new RoleAssignment table and the old User.role field
    (fallback for PM users not yet migrated to new system).
    """
    today = timezone.now().date()

    # Check new RBAC system first
    has_platform_role = RoleAssignment.objects.filter(
        user=user,
        role__code__in=["owner", "org_admin"],
        role__role_class="platform",
        valid_from__lte=today,
    ).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=today)
    ).exists()

    if has_platform_role:
        return True

    # Fallback — old PM role field
    return getattr(user, "role", None) == "admin" or getattr(user, "is_superuser", False)


def _check_sod(user, new_role) -> list:
    """
    Returns a list of SoD violation descriptions if assigning new_role
    to user would violate any mandatory SoD rule.
    Empty list means no violations.
    """
    today = timezone.now().date()

    # Get user's current active permission codes
    current_assignments = RoleAssignment.objects.filter(
        user=user,
        valid_from__lte=today,
    ).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=today)
    ).select_related("role")

    current_perm_ids = set()
    for assignment in current_assignments:
        perm_ids = assignment.role.role_permissions.values_list(
            "permission_id", flat=True
        )
        current_perm_ids.update(perm_ids)

    # Get new role's permission ids
    new_perm_ids = set(
        new_role.role_permissions.values_list("permission_id", flat=True)
    )

    # Combined set
    all_perm_ids = current_perm_ids | new_perm_ids

    # Check against SoD rules
    violations = []
    sod_rules = SodRule.objects.filter(
        Q(tenant_id__isnull=True) |
        Q(tenant_id=getattr(user, "organization_id", None))
    ).select_related("permission_a", "permission_b")

    for rule in sod_rules:
        if rule.permission_a_id in all_perm_ids and rule.permission_b_id in all_perm_ids:
            violations.append(
                f"{rule.permission_a.code} cannot coexist with {rule.permission_b.code}"
            )

    return violations


# ─────────────────────────────────────────────────────────────────────
# Views
# ─────────────────────────────────────────────────────────────────────

class RoleAssignmentListCreateView(APIView):
    """
    GET  — list current user's active role assignments
    POST — assign a role to a user (Org Admin or Owner only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List active assignments for the requesting user."""
        today = timezone.now().date()

        assignments = RoleAssignment.objects.filter(
            user=request.user,
            valid_from__lte=today,
        ).filter(
            Q(valid_to__isnull=True) | Q(valid_to__gte=today)
        ).select_related("role")

        data = [
            {
                "id":         a.pk,
                "role_code":  a.role.code,
                "role_name":  a.role.display_name,
                "platform":   a.platform,
                "scope_type": a.scope_type,
                "scope_id":   a.scope_id,
                "valid_from": a.valid_from,
                "valid_to":   a.valid_to,
            }
            for a in assignments
        ]
        return Response(data)

    def post(self, request):
        """
        Assign a role to a user.

        Required fields:
            user_id     — who gets the role
            role_code   — which role (e.g. 'hr_admin')
            platform    — which platform ('hrms', 'pm', 'crm')
            scope_type  — 'organization', 'department', 'workspace', etc.
            scope_id    — the ID of the scope object
            valid_from  — date string YYYY-MM-DD (optional, defaults to today)
            valid_to    — date string YYYY-MM-DD (optional, null = indefinite)

        Example:
            POST /api/v1/rbac/assignments/
            {
                "user_id":    42,
                "role_code":  "hr_admin",
                "platform":   "hrms",
                "scope_type": "organization",
                "scope_id":   1,
                "valid_from": "2026-07-16",
                "valid_to":   null
            }
        """
        # ── Permission check ──────────────────────────────────────────
        if not _is_org_admin(request.user):
            return Response(
                {"error": "Only Owner or Org Admin can assign roles."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Validate required fields ───────────────────────────────────
        data       = request.data
        user_id    = data.get("user_id")
        role_code  = data.get("role_code")
        platform   = data.get("platform")
        scope_type = data.get("scope_type")
        scope_id   = data.get("scope_id")

        if not all([user_id, role_code, platform, scope_type, scope_id is not None]):
            return Response(
                {"error": "user_id, role_code, platform, scope_type, scope_id are all required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Find the target user ───────────────────────────────────────
        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": f"User {user_id} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── Find the role ──────────────────────────────────────────────
        role = Role.objects.filter(
            code=role_code,
            platform__in=[platform, "all"],
        ).filter(
            Q(tenant_id__isnull=True) |
            Q(tenant_id=getattr(request.user, "organization_id", None))
        ).first()

        if not role:
            return Response(
                {"error": f"Role '{role_code}' not found for platform '{platform}'."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── SoD check ─────────────────────────────────────────────────
        violations = _check_sod(target_user, role)
        if violations:
            return Response(
                {
                    "error": "Assignment blocked — SoD violation.",
                    "violations": violations,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Parse dates ────────────────────────────────────────────────
        today      = timezone.now().date()
        valid_from = data.get("valid_from", str(today))
        valid_to   = data.get("valid_to", None)

        # ── Auto-revoke existing active role on same platform ──────────
        # If user already has an active role on this platform, expire it
        # before creating the new one. This ensures hrms_role always
        # returns the latest role — not the oldest one.
        from django.db.models import Q as Q2
        RoleAssignment.objects.filter(
            user_id    = target_user.pk,
            platform   = platform,
            valid_from__lte = today,
        ).filter(
            Q2(valid_to__isnull=True) | Q2(valid_to__gte=today)
        ).exclude(
            role = role  # do not revoke if same role is being re-assigned
        ).update(valid_to=today)

        # ── Create assignment ──────────────────────────────────────────
        assignment, created = RoleAssignment.objects.get_or_create(
            user       = target_user,
            role       = role,
            platform   = platform,
            scope_type = scope_type,
            scope_id   = scope_id,
            defaults   = {
                "valid_from":  valid_from,
                "valid_to":    valid_to,
                "assigned_by": request.user,
            },
        )

        if not created:
            return Response(
                {"message": "Assignment already exists.", "id": assignment.pk},
                status=status.HTTP_200_OK,
            )

        logger.info(
            "rbac: role assigned user=%s role=%s platform=%s by=%s",
            target_user.pk, role_code, platform, request.user.pk,
        )

        return Response(
            {
                "message":    f"{role.display_name} assigned to {target_user.email}.",
                "id":         assignment.pk,
                "role_code":  role.code,
                "role_name":  role.display_name,
                "platform":   platform,
                "scope_type": scope_type,
                "scope_id":   scope_id,
                "valid_from": str(assignment.valid_from),
                "valid_to":   str(assignment.valid_to) if assignment.valid_to else None,
            },
            status=status.HTTP_201_CREATED,
        )


class RoleAssignmentRevokeView(APIView):
    """
    DELETE /api/v1/rbac/assignments/<id>/

    Revokes a role assignment by setting valid_to = today.
    Does not delete the row — keeps the audit trail.
    Org Admin or Owner only.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not _is_org_admin(request.user):
            return Response(
                {"error": "Only Owner or Org Admin can revoke roles."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            assignment = RoleAssignment.objects.select_related("role", "user").get(pk=pk)
        except RoleAssignment.DoesNotExist:
            return Response(
                {"error": "Assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent revoking Owner role from the only Owner
        if assignment.role.code == "owner":
            other_owners = RoleAssignment.objects.filter(
                role__code="owner",
                valid_to__isnull=True,
            ).exclude(pk=pk).count()
            if other_owners == 0:
                return Response(
                    {"error": "Cannot revoke the only Owner. Assign Owner to another user first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        today = timezone.now().date()
        assignment.valid_to = today
        assignment.save(update_fields=["valid_to"])

        logger.info(
            "rbac: role revoked assignment=%s user=%s role=%s by=%s",
            pk, assignment.user_id, assignment.role.code, request.user.pk,
        )

        return Response(
            {
                "message":  f"{assignment.role.display_name} revoked from {assignment.user.email}.",
                "valid_to": str(today),
            },
            status=status.HTTP_200_OK,
        )


class RoleListView(APIView):
    """
    GET /api/v1/rbac/roles/?platform=hrms

    Lists available roles for a given platform.
    Used by the role assignment UI to populate the role picker.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        platform = request.query_params.get("platform", "hrms")

        roles = Role.objects.filter(
            platform__in=[platform, "all"],
        ).filter(
            Q(tenant_id__isnull=True) |
            Q(tenant_id=getattr(request.user, "organization_id", None))
        ).order_by("role_class", "code")

        data = [
            {
                "code":        r.code,
                "display_name":r.display_name,
                "role_class":  r.role_class,
                "platform":    r.platform,
                "description": r.description,
            }
            for r in roles
        ]
        return Response(data)


class RoleListWithStatsView(APIView):
    """
    GET /api/v1/rbac/roles/stats/?platform=hrms

    Returns all roles with user list and permission list.
    Used by the Roles & Permissions admin page.

    Query params:
        platform — filter by platform: pm | hrms | crm | all

    Response example:
    [
        {
            "code":             "hr_admin",
            "display_name":     "HR Admin",
            "description":      "Full HRMS access...",
            "role_class":       "functional",
            "platform":         "hrms",
            "is_system":        true,
            "is_editable":      false,
            "user_count":       1,
            "users": [
                {
                    "id":         1,
                    "email":      "harshitshukla@lensvox.com",
                    "full_name":  "Harshit Shukla",
                    "avatar":     null
                }
            ],
            "permission_count": 33,
            "permissions": [
                {
                    "code":         "employee.profile:create",
                    "display_name": "Add new employee",
                    "category":     "data"
                }
            ]
        }
    ]
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        from django.db.models import Q, Count

        platform = request.query_params.get("platform", None)
        org_id   = getattr(request.user, "organization_id", None)
        today    = timezone.now().date()

        # ── Build role queryset ────────────────────────────────────────
        qs = Role.objects.filter(
            Q(tenant_id__isnull=True) | Q(tenant_id=org_id)
        )

        if platform and platform != "all":
            qs = qs.filter(platform__in=[platform, "all"])

        qs = qs.annotate(
            permission_count=Count("role_permissions", distinct=True)
        ).order_by("role_class", "platform", "code")

        # ── Build response ─────────────────────────────────────────────
        data = []
        for role in qs:

            # ── Active users for this role ─────────────────────────────
            active_assignments = (
                RoleAssignment.objects
                .filter(
                    role            = role,
                    valid_from__lte = today,
                )
                .filter(
                    Q(valid_to__isnull=True) | Q(valid_to__gte=today)
                )
                .select_related("user")
                .distinct()
            )

            users = []
            seen_user_ids = set()
            for a in active_assignments:
                if a.user_id not in seen_user_ids:
                    seen_user_ids.add(a.user_id)
                    u = a.user
                    full_name = f"{u.first_name} {u.last_name}".strip() or u.username
                    avatar    = None
                    if u.avatar:
                        try:
                            avatar = request.build_absolute_uri(u.avatar.url)
                        except Exception:
                            avatar = None
                    users.append({
                        "id":        u.pk,
                        "email":     u.email,
                        "username":  u.username,
                        "full_name": full_name,
                        "avatar":    avatar,
                    })

            # ── Permissions for this role ──────────────────────────────
            role_perms = (
                role.role_permissions
                .select_related("permission")
                .order_by("permission__resource", "permission__action")
            )

            permissions = [
                {
                    "code":         f"{rp.permission.resource}:{rp.permission.action}",
                    "display_name": rp.permission.display_name,
                    "category":     rp.permission.category,
                    "row_scope":    rp.row_scope,
                }
                for rp in role_perms
            ]

            # is_editable — system and platform roles cannot be edited
            is_editable = (
                not role.is_system
                and role.role_class not in ["platform"]
                and role.tenant_id == org_id
            )

            data.append({
                "code":             role.code,
                "display_name":     role.display_name,
                "description":      role.description,
                "role_class":       role.role_class,
                "platform":         role.platform,
                "is_system":        role.is_system,
                "is_editable":      is_editable,
                "user_count":       len(users),
                "users":            users,
                "permission_count": role.permission_count,
                "permissions":      permissions,
                "permission_count": role.permission_count,
            })

        return Response(data)