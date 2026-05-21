from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    OrganizationViewSet,
    TenantSignupView,
    TenantDashboardView,
    TenantDetailView,
    TenantDeleteView,
    TenantToggleStatusView,
    WorkspaceListCreateView,
    WorkspaceSwitchView,
)

router = DefaultRouter()
router.register(r"", OrganizationViewSet, basename="organization")

urlpatterns = [
    # Public self-service signup (no auth required)
    path("signup/", TenantSignupView.as_view(), name="tenant-signup"),

    # Super-admin overview (superuser only)
    path("overview/", TenantDashboardView.as_view(), name="tenant-overview"),
    path("overview/<int:org_id>/", TenantDetailView.as_view(), name="tenant-detail"),
    path("overview/<int:org_id>/toggle-status/", TenantToggleStatusView.as_view(), name="tenant-toggle-status"),
    path("overview/<int:org_id>/delete/", TenantDeleteView.as_view(), name="tenant-delete"),
    path("workspaces/", WorkspaceListCreateView.as_view(), name="workspace-list-create"),
    path("workspaces/<int:workspace_id>/switch/", WorkspaceSwitchView.as_view(), name="workspace-switch"),
    # Admin CRUD for organizations
    path("", include(router.urls)),
]