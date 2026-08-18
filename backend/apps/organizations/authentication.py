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
    """
    JWT authentication that:
    1. Validates JWT signature using shared DYUKSA_JWT_SECRET
    2. Resolves the user via central_user_id (NOT local pk)
       JWT carries Central's user_id → we look up User.central_user_id
    3. Sets organisation and workspace context for TenantManager
    """

    def get_user(self, validated_token):
        """
        Override SimpleJWT's get_user to resolve by central_user_id.

        JWT payload carries user_id from Central DB.
        PM resolves the local User via central_user_id field.

        This means PM's local user.id (auto-increment) can differ from
        Central's user_id — no id collision issues.
        """
        from django.contrib.auth import get_user_model
        User = get_user_model()

        central_user_id = validated_token.get("user_id")
        if not central_user_id:
            return None

        try:
            user = User.objects.get(central_user_id=central_user_id)
            if not user.is_active:
                logger.warning(
                    "Central user_id=%s found in PM DB (pm_id=%s) "
                    "but is_active=False",
                    central_user_id, user.id,
                )
                return None
            return user
        except User.DoesNotExist:
            # User not provisioned in PM yet — log and return None
            logger.warning(
                "Central user_id=%s has no PM mirror. "
                "Webhook may not have fired yet.",
                central_user_id,
            )
            return None
        except Exception as e:
            logger.error(
                "Error resolving central_user_id=%s: %s",
                central_user_id, e,
            )
            return None

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            self.set_workspace_context(request, user)
        return result


class CentralJWTAuthentication(JWTAuthentication):
    """
    Resolves user via central_user_id (same as WorkspaceJWTAuthentication)
    but does NOT require or set workspace context.

    Use this for views that only need to identify the user
    but do NOT filter data by workspace:
      - UserPreferenceView (dashboard preferences)
      - ChangeUserRoleView
      - Any view that uses user directly without TenantManager

    WorkspaceJWTAuthentication should be used for views that
    query TenantModel data (projects, tasks, workspaces etc.)
    """

    def get_user(self, validated_token):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        central_user_id = validated_token.get("user_id")
        if not central_user_id:
            return None

        try:
            user = User.objects.get(central_user_id=central_user_id)
            if not user.is_active:
                return None
            return user
        except User.DoesNotExist:
            logger.warning(
                "CentralJWT: central_user_id=%s not found in PM DB.",
                central_user_id,
            )
            return None
        except Exception as e:
            logger.error(
                "CentralJWT: Error resolving central_user_id=%s: %s",
                central_user_id, e,
            )
            return None


class WorkspaceStaticTokenAuthentication(WorkspaceContextMixin, StaticTokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            self.set_workspace_context(request, user)
        return result