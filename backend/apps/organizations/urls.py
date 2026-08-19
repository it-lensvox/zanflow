from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    OrganizationViewSet,
    SendSignupOTPView,
    TenantSignupView,
    TenantDashboardView,
    TenantDetailView,
    TenantDeleteView,
    TenantToggleStatusView,
    WorkspaceListCreateView,
    WorkspaceDetailView,
    WorkspaceSwitchView,
    WorkspaceDeleteView,
    WorkspaceMembersView,
    WorkspaceMemberDetailView,
    WorkspaceAvailableUsersView,
    AddPlatformAccessView,
    TenantPlatformAccessView,
)

router = DefaultRouter()
router.register(r"", OrganizationViewSet, basename="organization")

urlpatterns = [
    # Public self-service signup (no auth required)
    path("signup/send-otp/", SendSignupOTPView.as_view(),       name="signup-send-otp"),
    path("signup/",          TenantSignupView.as_view(),         name="tenant-signup"),

    # SSO: self-service platform unlock (no auth required)
    path("add-platform/",    AddPlatformAccessView.as_view(),    name="add-platform-access"),

    # Workspace endpoints
    path("workspaces/",                                          WorkspaceListCreateView.as_view(),   name="workspace-list-create"),
    path("workspaces/<int:workspace_id>/",                       WorkspaceDetailView.as_view(),       name="workspace-detail"),
    path("workspaces/<int:workspace_id>/switch/",                WorkspaceSwitchView.as_view(),       name="workspace-switch"),
    path("workspaces/<int:workspace_id>/delete/",                WorkspaceDeleteView.as_view(),       name="workspace-delete"),
    path("workspaces/<int:workspace_id>/members/",               WorkspaceMembersView.as_view(),      name="workspace-members"),
    path("workspaces/<int:workspace_id>/members/<int:user_id>/", WorkspaceMemberDetailView.as_view(), name="workspace-member-detail"),
    path("workspaces/<int:workspace_id>/available-users/",       WorkspaceAvailableUsersView.as_view(), name="workspace-available-users"),

    # Super-admin overview (superuser only)
    path("overview/",                          TenantDashboardView.as_view(),    name="tenant-overview"),
    path("overview/<int:org_id>/",             TenantDetailView.as_view(),       name="tenant-detail"),
    path("overview/<int:org_id>/toggle-status/", TenantToggleStatusView.as_view(), name="tenant-toggle-status"),
    path("overview/<int:org_id>/delete/",      TenantDeleteView.as_view(),       name="tenant-delete"),
    path("overview/<int:org_id>/platform-access/", TenantPlatformAccessView.as_view(), name="tenant-platform-access"),

    # Admin CRUD for organizations
    path("", include(router.urls)),
]