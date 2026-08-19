"""
apps/rbac/urls.py

RBAC API endpoints.

Phase A endpoints:
    POST   /api/v1/rbac/assignments/          — assign a role to a user
    GET    /api/v1/rbac/assignments/          — list assignments for current user
    DELETE /api/v1/rbac/assignments/<id>/     — revoke an assignment

Phase B / C endpoints will be added here later:
    GET    /api/v1/rbac/roles/                — list available roles
    GET    /api/v1/rbac/permissions/          — list permissions
    POST   /api/v1/rbac/roles/               — create custom role (Phase C)
"""

from django.urls import path
from apps.rbac import views

urlpatterns = [
    path("assignments/",        views.RoleAssignmentListCreateView.as_view(), name="rbac-assignments"),
    path("assignments/<int:pk>/", views.RoleAssignmentRevokeView.as_view(),  name="rbac-assignment-revoke"),
    path("roles/",              views.RoleListView.as_view(),                 name="rbac-roles"),
]

# Added for Roles & Permissions admin page
from apps.rbac.views import RoleListWithStatsView
urlpatterns += [
    path("roles/stats/", RoleListWithStatsView.as_view(), name="rbac-roles-stats"),
]