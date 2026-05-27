"""
Workspace-aware authentication for DRF.

WHY THIS EXISTS:
    Django middleware runs BEFORE DRF authentication. When using JWT tokens,
    request.user is AnonymousUser at the middleware level.

    This authentication class wraps JWT auth and sets both organization
    AND workspace context AFTER the user is properly authenticated.

THREAD SAFETY:
    Since ASGI/Daphne can run views on different threads than where
    authentication happened, we store workspace_id on the request object
    AND in thread-local storage. The TenantManager checks both.
"""

import logging

from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.users.auth import StaticTokenAuthentication
from .context import set_current_organization, set_current_workspace
from .models import WorkspaceMembership

logger = logging.getLogger(__name__)


class WorkspaceContextMixin:
    """
    Mixin that sets organization + workspace context after authentication.
    Stores on BOTH request object and thread-local for maximum compatibility.
    """

    def set_workspace_context(self, request, user):
        if user is None or not user.is_authenticated:
            return

        # Set organization
        org_id = getattr(user, 'organization_id', None)
        if org_id:
            set_current_organization(org_id)
            request.organization_id = org_id

        # Set workspace from header
        workspace_id = request.META.get("HTTP_X_WORKSPACE_ID")
        if not workspace_id:
            return

        try:
            workspace_id = int(workspace_id)
        except (ValueError, TypeError):
            return

        # Validate membership
        is_valid = WorkspaceMembership.objects.filter(
            user=user,
            workspace_id=workspace_id,
            workspace__organization_id=org_id,
            workspace__is_active=True,
        ).exists()

        if is_valid:
            set_current_workspace(workspace_id)
            request.workspace_id = workspace_id
            request.organization_id = org_id
            logger.debug(
                "Workspace context set: user=%s, workspace=%s, org=%s",
                user.id, workspace_id, org_id,
            )
        else:
            logger.warning(
                "User %s denied access to workspace %s (org=%s)",
                user.id, workspace_id, org_id,
            )


class WorkspaceJWTAuthentication(WorkspaceContextMixin, JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            self.set_workspace_context(request, user)
        return result


class WorkspaceStaticTokenAuthentication(WorkspaceContextMixin, StaticTokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            self.set_workspace_context(request, user)
        return result