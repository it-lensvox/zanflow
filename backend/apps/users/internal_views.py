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