"""
Workspace-aware base classes for DRF views.

Daphne/ASGI runs DRF views on DIFFERENT threads than middleware/authentication.
Thread-local storage doesn't work across threads. 

These base classes override DRF's initial() to set the thread-local context
ON THE VIEW'S THREAD, so TenantManager works correctly.
"""

import logging
import threading
from rest_framework.views import APIView
from rest_framework.generics import (
    ListCreateAPIView,
    ListAPIView,
    CreateAPIView,
    RetrieveUpdateDestroyAPIView,
    RetrieveAPIView,
    UpdateAPIView,
    DestroyAPIView,
    GenericAPIView,
)
from .context import (
    set_current_organization,
    set_current_workspace,
    get_current_organization,
    get_current_workspace,
)
from .models import WorkspaceMembership

logger = logging.getLogger(__name__)


class WorkspaceContextMixin:
    """
    Mixin that sets workspace thread-local context ON THE VIEW'S THREAD.
    """

    def initial(self, request, *args, **kwargs):
        # Let DRF do authentication first
        super().initial(request, *args, **kwargs)

        # Now set context on THIS thread
        if request.user and request.user.is_authenticated:
            org_id = getattr(request.user, 'organization_id', None)
            if org_id:
                set_current_organization(org_id)

            workspace_id = request.META.get("HTTP_X_WORKSPACE_ID")
            if workspace_id:
                try:
                    workspace_id = int(workspace_id)
                except (ValueError, TypeError):
                    workspace_id = None

                if workspace_id:
                    cache_key = f"_ws_valid_{workspace_id}"
                    is_valid = getattr(request, cache_key, None)

                    if is_valid is None:
                        is_valid = WorkspaceMembership.objects.filter(
                            user=request.user,
                            workspace_id=workspace_id,
                            workspace__organization_id=org_id,
                            workspace__is_active=True,
                        ).exists()
                        setattr(request, cache_key, is_valid)

                    if is_valid:
                        set_current_workspace(workspace_id)
                        request.workspace_id = workspace_id

            # DEBUG: Verify context is set on this thread
            logger.info(
                "🟢 MIXIN initial() DONE: thread=%s, org=%s, workspace=%s, header=%s, user=%s",
                threading.current_thread().ident,
                get_current_organization(),
                get_current_workspace(),
                request.META.get("HTTP_X_WORKSPACE_ID"),
                request.user.username,
            )


# Drop-in replacements
class WorkspaceAPIView(WorkspaceContextMixin, APIView):
    pass

class WorkspaceListCreateAPIView(WorkspaceContextMixin, ListCreateAPIView):
    pass

class WorkspaceListAPIView(WorkspaceContextMixin, ListAPIView):
    pass

class WorkspaceCreateAPIView(WorkspaceContextMixin, CreateAPIView):
    pass

class WorkspaceRetrieveUpdateDestroyAPIView(WorkspaceContextMixin, RetrieveUpdateDestroyAPIView):
    pass

class WorkspaceRetrieveAPIView(WorkspaceContextMixin, RetrieveAPIView):
    pass

class WorkspaceUpdateAPIView(WorkspaceContextMixin, UpdateAPIView):
    pass

class WorkspaceDestroyAPIView(WorkspaceContextMixin, DestroyAPIView):
    pass

class WorkspaceGenericAPIView(WorkspaceContextMixin, GenericAPIView):
    pass