"""
Custom DRF permissions for team-based access control.
These permissions can be used across the application for team-aware authorization.
"""
from rest_framework import permissions

from .models import Team, TeamMember, TeamRole


class IsTeamMember(permissions.BasePermission):
    """
    Permission class that checks if user is a member of the team.
    Expects the view to have a `get_team()` method or team in URL kwargs.
    """
    message = "You must be a member of this team to perform this action."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Get team from view
        team = self._get_team(view, request)
        if not team:
            return True  # Let view handle team not found
        
        return team.is_member(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Get team from object
        team = self._get_team_from_object(obj)
        if not team:
            return False
        
        return team.is_member(request.user)
    
    def _get_team(self, view, request):
        """Extract team from view or URL kwargs."""
        if hasattr(view, "get_team"):
            return view.get_team()
        
        team_id = view.kwargs.get("team_id") or view.kwargs.get("pk")
        if team_id:
            try:
                return Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                return None
        return None
    
    def _get_team_from_object(self, obj):
        """Extract team from object."""
        if isinstance(obj, Team):
            return obj
        if hasattr(obj, "team"):
            return obj.team
        return None


class IsTeamOwner(permissions.BasePermission):
    """
    Permission class that checks if user is an owner of the team.
    """
    message = "Only team owners can perform this action."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team(view, request)
        if not team:
            return True  # Let view handle team not found
        
        return team.get_user_role(request.user) == TeamRole.OWNER
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team_from_object(obj)
        if not team:
            return False
        
        return team.get_user_role(request.user) == TeamRole.OWNER
    
    def _get_team(self, view, request):
        if hasattr(view, "get_team"):
            return view.get_team()
        
        team_id = view.kwargs.get("team_id") or view.kwargs.get("pk")
        if team_id:
            try:
                return Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                return None
        return None
    
    def _get_team_from_object(self, obj):
        if isinstance(obj, Team):
            return obj
        if hasattr(obj, "team"):
            return obj.team
        return None


class IsTeamManager(permissions.BasePermission):
    """
    Permission class that checks if user is a manager or owner of the team.
    Managers and owners can manage team members and settings.
    """
    message = "Only team managers and owners can perform this action."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team(view, request)
        if not team:
            return True  # Let view handle team not found
        
        return team.can_user_manage(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team_from_object(obj)
        if not team:
            return False
        
        return team.can_user_manage(request.user)
    
    def _get_team(self, view, request):
        if hasattr(view, "get_team"):
            return view.get_team()
        
        team_id = view.kwargs.get("team_id") or view.kwargs.get("pk")
        if team_id:
            try:
                return Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                return None
        return None
    
    def _get_team_from_object(self, obj):
        if isinstance(obj, Team):
            return obj
        if hasattr(obj, "team"):
            return obj.team
        return None


class IsTeamMemberOrReadOnly(permissions.BasePermission):
    """
    Permission that allows read access to anyone, write access to team members.
    """
    message = "You must be a team member to modify this resource."
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team(view, request)
        if not team:
            return True
        
        return team.is_member(request.user)
    
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team_from_object(obj)
        if not team:
            return False
        
        return team.is_member(request.user)
    
    def _get_team(self, view, request):
        if hasattr(view, "get_team"):
            return view.get_team()
        
        team_id = view.kwargs.get("team_id") or view.kwargs.get("pk")
        if team_id:
            try:
                return Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                return None
        return None
    
    def _get_team_from_object(self, obj):
        if isinstance(obj, Team):
            return obj
        if hasattr(obj, "team"):
            return obj.team
        return None


class IsTeamManagerOrReadOnly(permissions.BasePermission):
    """
    Permission that allows read access to team members, write access to managers/owners.
    """
    message = "Only team managers and owners can modify this resource."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team(view, request)
        if not team:
            return True
        
        if request.method in permissions.SAFE_METHODS:
            return team.is_member(request.user)
        
        return team.can_user_manage(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        team = self._get_team_from_object(obj)
        if not team:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return team.is_member(request.user)
        
        return team.can_user_manage(request.user)
    
    def _get_team(self, view, request):
        if hasattr(view, "get_team"):
            return view.get_team()
        
        team_id = view.kwargs.get("team_id") or view.kwargs.get("pk")
        if team_id:
            try:
                return Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                return None
        return None
    
    def _get_team_from_object(self, obj):
        if isinstance(obj, Team):
            return obj
        if hasattr(obj, "team"):
            return obj.team
        return None


class CanManageTeamMember(permissions.BasePermission):
    """
    Permission for managing specific team members.
    - Owners can manage anyone
    - Managers can manage members but not other managers/owners
    - Members cannot manage anyone
    """
    message = "You don't have permission to manage this team member."
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        if not isinstance(obj, TeamMember):
            return False
        
        team = obj.team
        user_role = team.get_user_role(request.user)
        
        if not user_role:
            return False
        
        # Owners can manage anyone
        if user_role == TeamRole.OWNER:
            return True
        
        # Managers can only manage members
        if user_role == TeamRole.MANAGER:
            return obj.role == TeamRole.MEMBER
        
        return False


# Mixin for team-aware views
class TeamPermissionMixin:
    """
    Mixin that provides team context to views.
    Add this to views that need team-based permissions.
    """
    
    _team = None
    
    def get_team(self):
        """Get the team for the current request."""
        if self._team is not None:
            return self._team
        
        team_id = self.kwargs.get("team_id") or self.kwargs.get("pk")
        if team_id:
            try:
                self._team = Team.objects.get(id=team_id)
            except Team.DoesNotExist:
                self._team = None
        
        return self._team
    
    def get_team_or_404(self):
        """Get the team or raise 404."""
        from django.shortcuts import get_object_or_404
        
        if self._team is not None:
            return self._team
        
        team_id = self.kwargs.get("team_id") or self.kwargs.get("pk")
        self._team = get_object_or_404(Team, id=team_id)
        return self._team


# Permission classes for project integration
class HasTeamAccess(permissions.BasePermission):
    """
    Permission for accessing resources that belong to a team (e.g., projects).
    The object must have a 'team' attribute.
    """
    message = "You don't have access to this team's resources."
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        if not hasattr(obj, "team") or not obj.team:
            # Object doesn't belong to a team, allow access
            return True
        
        return obj.team.is_member(request.user)


class HasTeamWriteAccess(permissions.BasePermission):
    """
    Permission for modifying resources that belong to a team.
    Requires manager or owner role for write operations.
    """
    message = "You need manager or owner role to modify this team's resources."
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            if not hasattr(obj, "team") or not obj.team:
                return True
            return obj.team.is_member(request.user)
        
        if not hasattr(obj, "team") or not obj.team:
            return True
        
        return obj.team.can_user_manage(request.user)
