"""
Tenant middleware for ZanFlow.

This middleware runs on every request and is responsible for:
  1. Extracting the organization_id from the authenticated user.
  2. Blocking requests from users in deactivated organizations.
  3. Storing it in thread-local context so TenantManager can use it.
  4. Clearing the context after the response to prevent cross-request leakage.
"""

import logging

from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

from .models import OrganizationMember
from .context import set_current_organization, clear_current_organization

logger = logging.getLogger(__name__)


class TenantMiddleware(MiddlewareMixin):
    """
    Sets the tenant context for every authenticated request.

    Placement in MIDDLEWARE:
        Must come AFTER `AuthenticationMiddleware` so that `request.user`
        is populated before we try to read it.

    Behaviour:
        - Authenticated user with an `organization_id` → context is set.
        - User in a deactivated org → 403 Forbidden.
        - Anonymous / unauthenticated request → context stays None (unfiltered).
        - Superusers without an org → context stays None (full access).
    """

    def process_request(self, request):
        """Extract org from user and set thread-local context."""
        organization_id = None

        if hasattr(request, "user") and request.user.is_authenticated:
            organization_id = getattr(request.user, "organization_id", None)

            if organization_id:
                # Block users from deactivated organizations
                organization = getattr(request.user, "organization", None)
                if organization and not organization.is_active:
                    logger.warning(
                        "TenantMiddleware: Blocked user=%s from deactivated org=%s",
                        request.user.pk,
                        organization_id,
                    )
                    return JsonResponse(
                        {
                            "error": "Your organization has been deactivated. "
                            "Please contact your administrator."
                        },
                        status=403,
                    )

                logger.debug(
                    "TenantMiddleware: Setting org=%s for user=%s",
                    organization_id,
                    request.user.pk,
                )
            else:
                logger.debug(
                    "TenantMiddleware: User %s has no organization assigned.",
                    request.user.pk,
                )

        set_current_organization(organization_id)

    def process_response(self, request, response):
        """Always clear the context after the request is complete."""
        clear_current_organization()
        return response

    def process_exception(self, request, exception):
        """Clear context even if an unhandled exception occurs."""
        clear_current_organization()

class TenantMiddleware:
    """
    Intercepts the X-Workspace-ID header and scopes the database context.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Always clear the context at the start to prevent data leakage between threads
        clear_current_organization()

        # 2. Skip tenant logic for unauthenticated requests
        if not request.user.is_authenticated:
            return self.get_response(request)

        # 3. Look for the custom header (Django converts X-Workspace-ID to HTTP_X_WORKSPACE_ID)
        workspace_id = request.META.get("HTTP_X_WORKSPACE_ID")

        if workspace_id:
            try:
                # 4. Validate the user actually belongs to this workspace
                membership = OrganizationMember.objects.select_related("organization").get(
                    user=request.user,
                    organization_id=workspace_id,
                    organization__is_active=True
                )
                
                # 5. Set the thread-local context for the TenantManager!
                set_current_organization(membership.organization.id)
                
                # Optional but highly recommended: attach the context directly to the 
                # request so your views/permissions can easily check roles.
                request.workspace = membership.organization
                request.workspace_role = membership.role

            except OrganizationMember.DoesNotExist:
                # Security: The user either doesn't belong to this workspace, 
                # or it doesn't exist/is deactivated. Stop the request immediately.
                logger.warning(f"User {request.user.id} attempted unauthorized access to workspace {workspace_id}")
                return JsonResponse(
                    {"detail": "Invalid workspace ID or you do not have access."}, 
                    status=403
                )
        else:
            # If no header is provided, we leave the tenant context empty.
            # You can decide how to handle this:
            # Option A: Let the view handle it (it will see empty data or throw a 400).
            # Option B: Fallback to the user's "default" workspace.
            pass

        # Continue processing the request
        response = self.get_response(request)
        
        # 6. Clean up after the request finishes
        clear_current_organization()
        
        return response
