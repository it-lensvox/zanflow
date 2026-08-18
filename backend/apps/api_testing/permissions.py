"""
Custom permissions for API Testing Platform.

Implements role-based access control for:
- Backend Members: Full CRUD on APIs and collections
- Managers/Admins: View and run APIs
- Non-Tech Users: Run APIs only (no edit access)

These permissions integrate with the existing Zanflow user roles.
"""
from rest_framework import permissions


class BaseAPITestingPermission(permissions.BasePermission):
    """
    Base permission class with helper methods for role checking.
    
    Assumes the User model has a 'role' field with values like:
    - 'admin'
    - 'manager'
    - 'backend_member'
    - 'non_tech_member'
    
    Adjust role field name and values based on your User model.
    """
    
    # Define role constants (adjust to match your User model)
    ADMIN_ROLES = ['admin', 'Admin', 'ADMIN']
    MANAGER_ROLES = ['manager', 'Manager', 'MANAGER']
    BACKEND_ROLES = ['backend_member', 'Backend Member', 'backend', 'developer', 'Developer']
    NON_TECH_ROLES = ['non_tech_member', 'Non-Tech Member', 'non_tech', 'member', 'Member']
    
    def get_user_role(self, user):
        """
        Get the user's role from the User model.
        
        Tries multiple common role field names for compatibility.
        Override this method if your User model uses a different structure.
        """
        # Try common role field names
        for field_name in ['role', 'user_role', 'user_type', 'type']:
            if hasattr(user, field_name):
                role = getattr(user, field_name)
                # Handle if role is a model instance (ForeignKey)
                if hasattr(role, 'name'):
                    return role.name
                # Handle choices field
                if hasattr(role, 'value'):
                    return role.value
                return str(role) if role else None
        
        # Try checking group membership
        if hasattr(user, 'groups'):
            groups = user.groups.values_list('name', flat=True)
            if groups:
                return list(groups)[0]
        
        return None
    
    def is_admin(self, user):
        """Check if user is an admin."""
        if user.is_superuser:
            return True
        role = self.get_user_role(user)
        return role in self.ADMIN_ROLES if role else False
    
    def is_manager(self, user):
        """Check if user is a manager."""
        role = self.get_user_role(user)
        return role in self.MANAGER_ROLES if role else False
    
    def is_backend_member(self, user):
        """Check if user is a backend member/developer."""
        role = self.get_user_role(user)
        return role in self.BACKEND_ROLES if role else False
    
    def is_non_tech_member(self, user):
        """Check if user is a non-technical member."""
        role = self.get_user_role(user)
        return role in self.NON_TECH_ROLES if role else False
    
    def can_create_edit(self, user):
        """Check if user can create/edit APIs and collections."""
        return self.is_admin(user) or self.is_backend_member(user)
    
    def can_view_run(self, user):
        """Check if user can view and run APIs."""
        return (
            self.is_admin(user) or 
            self.is_manager(user) or 
            self.is_backend_member(user) or
            self.is_non_tech_member(user)
        )
    
    def can_run_only(self, user):
        """Check if user can only run (not edit) APIs."""
        return self.is_non_tech_member(user) or self.is_manager(user)


class CanCreateEditAPICollection(BaseAPITestingPermission):
    """
    Permission for creating and editing API collections.
    
    Allowed: Admin, Backend Member
    Denied: Manager, Non-Tech Member
    """
    
    message = "Only Admin and Backend Members can create/edit API collections."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read operations allowed for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write operations only for admins and backend members
        return self.can_create_edit(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read operations allowed for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write operations only for admins and backend members
        return self.can_create_edit(request.user)


class CanCreateEditAPIEndpoint(BaseAPITestingPermission):
    """
    Permission for creating and editing API endpoints.
    
    Allowed: Admin, Backend Member
    Denied: Manager, Non-Tech Member
    """
    
    message = "Only Admin and Backend Members can create/edit API endpoints."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read operations allowed for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write operations only for admins and backend members
        return self.can_create_edit(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read operations allowed for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write operations only for admins and backend members
        return self.can_create_edit(request.user)


class CanManageAuthCredentials(BaseAPITestingPermission):
    """
    Permission for managing authentication credentials.
    
    Only Admin and Backend Members can manage credentials.
    This is a sensitive operation with no read access for others.
    """
    
    message = "Only Admin and Backend Members can manage authentication credentials."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # All credential operations restricted to admins and backend members
        return self.can_create_edit(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        return self.can_create_edit(request.user)


class CanRunAPIs(BaseAPITestingPermission):
    """
    Permission for running/executing APIs.
    
    Allowed: All authenticated users (Admin, Manager, Backend, Non-Tech)
    This enables the "one-click run" feature for all team members.
    """
    
    message = "You must be authenticated to run APIs."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # All authenticated users can run APIs
        return True
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        return True


class CanViewExecutionHistory(BaseAPITestingPermission):
    """
    Permission for viewing execution history.
    
    - All authenticated users can view history
    - Users can only view their own execution history unless admin/manager
    """
    
    message = "You must be authenticated to view execution history."
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins and managers can view all history
        if self.is_admin(request.user) or self.is_manager(request.user):
            return True
        
        # Backend members can view all history (for debugging)
        if self.is_backend_member(request.user):
            return True
        
        # Non-tech members can only view their own history
        if hasattr(obj, 'executed_by'):
            return obj.executed_by == request.user
        
        return True


class CanManageSchedules(BaseAPITestingPermission):
    """
    Permission for managing scheduled runs.
    
    Only Admin and Backend Members can create/edit schedules.
    Managers can view schedules.
    """
    
    message = "Only Admin and Backend Members can manage scheduled runs."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read operations for admin, manager, backend
        if request.method in permissions.SAFE_METHODS:
            return (
                self.is_admin(request.user) or 
                self.is_manager(request.user) or 
                self.is_backend_member(request.user)
            )
        
        # Write operations only for admins and backend members
        return self.can_create_edit(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return (
                self.is_admin(request.user) or 
                self.is_manager(request.user) or 
                self.is_backend_member(request.user)
            )
        
        return self.can_create_edit(request.user)


class IsOwnerOrAdmin(BaseAPITestingPermission):
    """
    Permission that allows access to owners of an object or admins.
    
    Useful for personal data like user-specific credentials or results.
    """
    
    message = "You can only access your own resources or be an admin."
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins can access anything
        if self.is_admin(request.user):
            return True
        
        # Check various owner fields
        owner_fields = ['created_by', 'executed_by', 'owner', 'user']
        for field in owner_fields:
            if hasattr(obj, field):
                owner = getattr(obj, field)
                if owner == request.user:
                    return True
        
        return False


# Composite permission classes for common use cases

class CollectionPermission(BaseAPITestingPermission):
    """
    Combined permission for API Collection viewset.
    
    - List/Retrieve: All authenticated users
    - Create/Update/Delete: Admin and Backend Members only
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return self.can_create_edit(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return self.can_create_edit(request.user)


class EndpointPermission(BaseAPITestingPermission):
    """
    Combined permission for API Endpoint viewset.
    
    - List/Retrieve: All authenticated users
    - Create/Update/Delete: Admin and Backend Members only
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return self.can_create_edit(request.user)
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return self.can_create_edit(request.user)
