"""
apps/users/internal_views.py  (PM Backend)

Internal API endpoints for cross-product communication within Dyuksa.

These endpoints are NOT for end users. They are called by other Dyuksa
products (HRMS, CRM etc.) to fetch data from the Central Auth.

SECURITY:
    Protected by X-Internal-Token header.
    This token is a shared secret set in both PM and HRMS .env files.
    It is never exposed to the frontend or end users.

    INTERNAL_API_TOKEN in PM .env   must equal
    INTERNAL_API_TOKEN in HRMS .env

ENDPOINTS:
    GET /api/v1/internal/users/?org_id=1
        Returns all active users for an organisation.
        Called by HRMS sync_employees_from_pm management command.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()


class InternalTokenPermission:
    """
    Validates the X-Internal-Token header.
    Not a DRF permission class — used as a simple check inside views.
    """
    @staticmethod
    def is_valid(request):
        token = request.headers.get("X-Internal-Token", "")
        expected = getattr(settings, "INTERNAL_API_TOKEN", "")
        if not expected:
            return False
        return token == expected


class InternalUserListView(APIView):
    """
    GET /api/v1/internal/users/?org_id=1

    Returns all active users for an organisation.
    Called by HRMS to sync employees.

    Query params:
        org_id  (required) — organisation ID to filter by
    """
    authentication_classes = []  # no JWT needed — uses internal token
    permission_classes     = []  # handled manually below

    def get(self, request):
        # Validate internal token
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
            "id", "email", "username",
            "first_name", "last_name",
            "role", "organization_id",
        ).order_by("id")

        return Response(list(users))

class UserCreatedWebhookView(APIView):
    """
    POST /api/v1/internal/webhook/user-created/

    Called by Central when a new user is created and PM portal
    grant is assigned. PM uses this to ensure the user has a
    workspace_member role assignment in the PM RoleAssignment table.

    Since PM and Central share the same database — the user record
    already exists. This webhook triggers the role assignment only.

    Payload:
        {
            "user_id":    123,
            "email":      "ravi@lensvox.com",
            "first_name": "Ravi",
            "last_name":  "Kumar",
            "org_id":     1,
            "designation": "Software Developer"
        }

    Response:
        200 { "status": "provisioned", "role": "workspace_member" }
        200 { "status": "already_exists" }
        401 { "error": "Unauthorized" }
        400 { "error": "..." }
    """
    authentication_classes = []
    permission_classes     = []

    def post(self, request):
        if not InternalTokenPermission.is_valid(request):
            return Response(
                {"error": "Invalid or missing X-Internal-Token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user_id = request.data.get("user_id")
        org_id  = request.data.get("org_id")

        if not user_id or not org_id:
            return Response(
                {"error": "user_id and org_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.rbac.models import Role, RoleAssignment
            from django.utils import timezone

            today = timezone.now().date()

            # Find workspace_member role
            role = Role.objects.filter(
                tenant_id = None,
                code      = "workspace_member",
                platform  = "pm",
            ).first()

            if not role:
                return Response(
                    {
                        "status":  "skipped",
                        "reason":  "workspace_member role not seeded yet. "
                                   "Run: python manage.py seed_pm_roles",
                    },
                    status=status.HTTP_200_OK,
                )

            # Assign workspace_member at org scope
            _, created = RoleAssignment.objects.get_or_create(
                user_id    = user_id,
                role       = role,
                platform   = "pm",
                scope_type = "organization",
                scope_id   = org_id,
                defaults   = {
                    "valid_from":  today,
                    "valid_to":    None,
                    "assigned_by": None,
                },
            )

            import logging
            logging.getLogger(__name__).info(
                "pm: %s workspace_member for user_id=%s org_id=%s",
                "assigned" if created else "already existed",
                user_id, org_id,
            )

            return Response({
                "status": "provisioned" if created else "already_exists",
                "role":   "workspace_member",
            })

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(
                "pm: Failed to provision user_id=%s: %s", user_id, e
            )
            return Response(
                {"error": f"Provisioning failed: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
