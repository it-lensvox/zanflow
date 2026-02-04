"""
URL configuration for the teams app.
"""
from django.urls import path

from .views import (
    TeamViewSet,
    TeamMemberViewSet,
    TeamChoicesView,
    AvailableUsersView,
    AllUsersSearchView,
)

app_name = "teams"

urlpatterns = [
    # =====================
    # Team Endpoints
    # =====================
    
    # List all teams / Create a new team
    path(
        "",
        TeamViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="team-list"
    ),
    
    # Get dropdown choices (team types, colors, roles)
    path(
        "choices/",
        TeamChoicesView.as_view(),
        name="team-choices"
    ),
    
    # Search all users (for team creation)
    path(
        "users/search/",
        AllUsersSearchView.as_view(),
        name="users-search"
    ),
    
    # Get user's teams
    path(
        "my-teams/",
        TeamViewSet.as_view({
            "get": "my_teams",
        }),
        name="my-teams"
    ),
    
    # Get / Update / Delete a specific team
    path(
        "<int:pk>/",
        TeamViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="team-detail"
    ),
    
    # Leave a team
    path(
        "<int:pk>/leave/",
        TeamViewSet.as_view({
            "post": "leave",
        }),
        name="team-leave"
    ),
    
    # =====================
    # Team Member Endpoints
    # =====================
    
    # List members / Add a member
    path(
        "<int:team_id>/members/",
        TeamMemberViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="team-members-list"
    ),
    
    # Bulk add members
    path(
        "<int:team_id>/members/bulk/",
        TeamMemberViewSet.as_view({
            "post": "bulk",
        }),
        name="team-members-bulk"
    ),
    
    # Get / Update / Delete a specific member
    path(
        "<int:team_id>/members/<int:pk>/",
        TeamMemberViewSet.as_view({
            "get": "retrieve",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="team-member-detail"
    ),
    
    # Get available users to add to a team
    path(
        "<int:team_id>/available-users/",
        AvailableUsersView.as_view(),
        name="team-available-users"
    ),
    path(
    "<int:pk>/favorite/",
    TeamViewSet.as_view({"post": "favorite"}),
    name="team-favorite"
),
]
