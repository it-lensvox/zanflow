import logging
from .context import (
    set_current_organization,
    clear_current_organization,
    set_current_workspace,
    clear_current_workspace,
)

logger = logging.getLogger(__name__)


class TenantMiddleware:
    """
    Django Middleware for tenant context.
    
    For ASGI/Daphne: Thread-locals set here may not persist to the view
    thread. The real workspace filtering for DRF views happens via
    WorkspaceFilterMixin which reads directly from request.META.
    
    This middleware still handles:
      - Session-authenticated users (Django admin)
      - Cleanup between requests
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        clear_current_organization()
        clear_current_workspace()

        if hasattr(request, 'user') and request.user.is_authenticated:
            org_id = getattr(request.user, 'organization_id', None)
            if org_id:
                set_current_organization(org_id)

        response = self.get_response(request)

        clear_current_organization()
        clear_current_workspace()

        return response