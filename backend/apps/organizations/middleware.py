import logging
from .context import set_current_organization, clear_current_organization

logger = logging.getLogger(__name__)

class TenantMiddleware:
    """
    Original Middleware: Scopes the database context to the user's single organization.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Always clear the context at the start to prevent data leakage between threads
        clear_current_organization()

        # 2. If the user is logged in and has an organization, set the context
        if request.user.is_authenticated:
            # Under the original setup, the User model has a direct organization_id ForeignKey
            if getattr(request.user, 'organization_id', None):
                set_current_organization(request.user.organization_id)

        # 3. Continue processing the request
        response = self.get_response(request)
        
        # 4. Clean up after the request finishes
        clear_current_organization()
        
        return response