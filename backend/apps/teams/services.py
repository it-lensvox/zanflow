"""
Team services for ZanFlow.
Clean separation of business logic with atomic transactions.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional
from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.contrib.auth import get_user_model
from apps.chat.services import ChatRoomService
from apps.chat.models import ChatRoom
import logging
from .models import Team, TeamMember, TeamRole, TeamType, TeamColor
logger = logging.getLogger(__name__)
if TYPE_CHECKING:
    from apps.users.models import User as UserType

User = get_user_model()


class TeamServiceError(Exception):
    """Custom exception for team service errors."""
    pass


class TeamService:
    """
    Service class for team-related business logic.
    All methods use atomic transactions for data consistency.
    """
    
    @staticmethod
    @transaction.atomic
    def create_team(
        name: str,
        creator: "UserType",
        team_type: str = TeamType.DEVELOPMENT,
        color: str = TeamColor.BLUE,
        description: str = "",
        leader_id: Optional[int] = None,
        member_ids: Optional[List[int]] = None
    ) -> Team:
        """
        Create a new team with the creator as owner.
        
        Args:
            name: Team name (required)
            creator: User creating the team (becomes owner)
            team_type: Type of team (development, qa, etc.)
            color: Team color for UI display
            description: Optional team description
            leader_id: Optional leader ID (defaults to creator)
            member_ids: Optional list of user IDs to add as members
            
        Returns:
            Created Team instance
            
        Raises:
            TeamServiceError: If validation fails
        """
        if not name or not name.strip():
            raise TeamServiceError("Team name is required")
        
        # Determine the leader (defaults to creator if not specified)
        leader = creator
        if leader_id:
            try:
                leader = User.objects.get(id=leader_id)
            except User.DoesNotExist:
                raise TeamServiceError(f"Leader with ID {leader_id} not found")
        
        # Create the team
        team = Team.objects.create(
            name=name.strip(),
            team_type=team_type,
            color=color,
            description=description,
            leader=leader
        )
        
        # Add creator as owner
        TeamMember.objects.create(
            team=team,
            user=creator,
            role=TeamRole.OWNER,
            added_by=creator
        )
        
        # If leader is different from creator, add leader as manager
        if leader != creator:
            TeamMember.objects.create(
                team=team,
                user=leader,
                role=TeamRole.MANAGER,
                added_by=creator
            )
        
        # Add additional members if provided
        if member_ids:
            members_to_add = []
            # Get IDs to skip (creator and leader)
            skip_ids = {creator.id}
            if leader:
                skip_ids.add(leader.id)
            
            for user_id in member_ids:
                # Skip if already added (creator or leader)
                if user_id in skip_ids:
                    continue
                    
                try:
                    user = User.objects.get(id=user_id)
                    members_to_add.append(
                        TeamMember(
                            team=team,
                            user=user,
                            role=TeamRole.MEMBER,
                            added_by=creator
                        )
                    )
                except User.DoesNotExist:
                    # Skip invalid user IDs silently or raise error
                    continue
            
            if members_to_add:
                TeamMember.objects.bulk_create(members_to_add)
            try:
                # 1. Find the room (created by the Team signal)
                room = ChatRoom.objects.filter(
                    room_type=ChatRoom.RoomType.TEAM, 
                    team=team
                ).first()
                
                # 2. If signal failed to create room, create it now
                if not room:
                    room = ChatRoomService.create_team_room(team, creator)

                # 3. Add the members we just bulk_created
                # (Loop through the list we just sent to bulk_create)
                if members_to_add:
                    for member in members_to_add:
                        # member.user is already attached in your code above
                        ChatRoomService.add_participant(room, member.user)
                        
            except Exception as e:
                # Log error but don't stop the team creation
                logger.error(f"Failed to sync team members to chat: {e}")
        
        return team
    
    @staticmethod
    @transaction.atomic
    def update_team(
        team: Team,
        updated_by: "UserType",
        **kwargs
    ) -> Team:
        """
        Update team details.
        
        Args:
            team: Team instance to update
            updated_by: User performing the update
            **kwargs: Fields to update (name, team_type, color, description, leader_id)
            
        Returns:
            Updated Team instance
            
        Raises:
            PermissionDenied: If user lacks permission
            TeamServiceError: If validation fails
        """
        # Check permissions
        if not team.can_user_manage(updated_by):
            raise PermissionDenied("You don't have permission to update this team")
        
        # Update allowed fields
        allowed_fields = ["name", "team_type", "color", "description"]
        for field in allowed_fields:
            if field in kwargs and kwargs[field] is not None:
                value = kwargs[field]
                if field == "name":
                    value = value.strip()
                    if not value:
                        raise TeamServiceError("Team name cannot be empty")
                setattr(team, field, value)
        
        # Handle leader update separately
        if "leader_id" in kwargs and kwargs["leader_id"]:
            try:
                new_leader = User.objects.get(id=kwargs["leader_id"])
                # Ensure new leader is a team member
                if not team.is_member(new_leader):
                    # Add them as a manager if not already a member
                    TeamMemberService.add_member(
                        team=team,
                        user=new_leader,
                        role=TeamRole.MANAGER,
                        added_by=updated_by
                    )
                team.leader = new_leader
            except User.DoesNotExist:
                raise TeamServiceError("Specified leader not found")
        
        team.save()
        return team
    
    @staticmethod
    @transaction.atomic
    def delete_team(
        team: Team,
        deleted_by: "UserType",
        hard_delete: bool = False
    ) -> None:
        """
        Delete a team (soft delete by default).
        
        Args:
            team: Team to delete
            deleted_by: User performing the deletion
            hard_delete: If True, permanently delete the team
            
        Raises:
            PermissionDenied: If user is not an owner
        """
        # Only owners can delete teams
        user_role = team.get_user_role(deleted_by)
        if user_role != TeamRole.OWNER:
            raise PermissionDenied("Only team owners can delete the team")
        
        if hard_delete:
            # Hard delete removes all members first
            team.members.all().delete()
            team.delete()
        else:
            # Soft delete the team and all memberships
            for member in team.members.filter(deleted_at__isnull=True):
                member.soft_delete()
            team.soft_delete()
    
    @staticmethod
    def get_user_teams(user: "UserType", include_deleted: bool = False):
        """
        Get all teams a user belongs to.
        
        Args:
            user: User to get teams for
            include_deleted: Whether to include soft-deleted teams
            
        Returns:
            QuerySet of Team objects
        """
        memberships = TeamMember.objects.filter(
            user=user,
            deleted_at__isnull=True
        ).values_list("team_id", flat=True)
        
        if include_deleted:
            return Team.all_objects.filter(id__in=memberships)
        return Team.objects.filter(id__in=memberships)
    
    @staticmethod
    def get_team_with_members(team_id: int) -> Optional[Team]:
        """
        Get a team with its members prefetched.
        
        Args:
            team_id: ID of the team
            
        Returns:
            Team instance or None
        """
        try:
            return Team.objects.prefetch_related(
                "members",
                "members__user"
            ).get(id=team_id)
        except Team.DoesNotExist:
            return None


class TeamMemberService:
    """
    Service class for team membership operations.
    """
    
    @staticmethod
    @transaction.atomic
    def add_member(
        team: Team,
        user: "UserType",
        role: str = TeamRole.MEMBER,
        added_by: Optional["UserType"] = None
    ) -> TeamMember:
        """
        Add a user to a team.
        
        Args:
            team: Team to add user to
            user: User to add
            role: Role to assign (default: MEMBER)
            added_by: User who is adding this member
            
        Returns:
            Created TeamMember instance
            
        Raises:
            TeamServiceError: If user is already a member
            PermissionDenied: If added_by lacks permission
        """
        # Check if added_by has permission
        if added_by and not team.can_user_manage(added_by):
            raise PermissionDenied("You don't have permission to add members")
        
        # Check for existing membership (including soft-deleted)
        existing = TeamMember.all_objects.filter(team=team, user=user).first()
        
        if existing:
            if existing.is_deleted:
                # Restore the membership with new role
                existing.role = role
                existing.added_by = added_by
                existing.restore()
                return existing
            else:
                raise TeamServiceError(
                    f"User {user.email} is already a member of this team"
                )
        
        return TeamMember.objects.create(
            team=team,
            user=user,
            role=role,
            added_by=added_by
        )
    
    @staticmethod
    @transaction.atomic
    def add_members_bulk(
        team: Team,
        user_ids: List[int],
        role: str = TeamRole.MEMBER,
        added_by: Optional["UserType"] = None
    ) -> List[TeamMember]:
        """
        Add multiple users to a team.
        
        Args:
            team: Team to add users to
            user_ids: List of user IDs (integers)
            role: Role to assign to all users
            added_by: User who is adding members
            
        Returns:
            List of created TeamMember instances
        """
        if added_by and not team.can_user_manage(added_by):
            raise PermissionDenied("You don't have permission to add members")
        
        # Get existing member user IDs
        existing_user_ids = set(
            team.members.filter(
                deleted_at__isnull=True
            ).values_list("user_id", flat=True)
        )
        
        # Filter out existing members
        new_user_ids = [uid for uid in user_ids if uid not in existing_user_ids]
        
        # Get valid users
        users = User.objects.filter(id__in=new_user_ids)
        
        # Create memberships
        members = [
            TeamMember(
                team=team,
                user=user,
                role=role,
                added_by=added_by
            )
            for user in users
        ]
        
        return TeamMember.objects.bulk_create(members)
    
    @staticmethod
    @transaction.atomic
    def remove_member(
        team: Team,
        user: "UserType",
        removed_by: "UserType",
        hard_delete: bool = False
    ) -> None:
        """
        Remove a user from a team.
        
        Args:
            team: Team to remove user from
            user: User to remove
            removed_by: User performing the removal
            hard_delete: If True, permanently delete the membership
            
        Raises:
            TeamServiceError: If trying to remove the last owner
            PermissionDenied: If removed_by lacks permission
        """
        # Check permissions
        if not team.can_user_manage(removed_by):
            raise PermissionDenied("You don't have permission to remove members")
        
        membership = TeamMember.objects.filter(
            team=team,
            user=user,
            deleted_at__isnull=True
        ).first()
        
        if not membership:
            raise TeamServiceError("User is not a member of this team")
        
        # Prevent removing the last owner
        if membership.role == TeamRole.OWNER:
            owner_count = team.get_owners().count()
            if owner_count <= 1:
                raise TeamServiceError(
                    "Cannot remove the last owner. Assign another owner first."
                )
        
        # Update team leader if removing current leader
        if team.leader == user:
            # Find another owner or manager to be leader
            new_leader = team.members.filter(
                deleted_at__isnull=True,
                role__in=[TeamRole.OWNER, TeamRole.MANAGER]
            ).exclude(user=user).first()
            
            if new_leader:
                team.leader = new_leader.user
                team.save(update_fields=["leader", "updated_at"])
        
        if hard_delete:
            membership.delete()
        else:
            membership.soft_delete()
    
    @staticmethod
    @transaction.atomic
    def update_member_role(
        team: Team,
        user: "UserType",
        new_role: str,
        updated_by: "UserType"
    ) -> TeamMember:
        """
        Update a team member's role.
        
        Args:
            team: Team containing the member
            user: User whose role to update
            new_role: New role to assign
            updated_by: User performing the update
            
        Returns:
            Updated TeamMember instance
            
        Raises:
            TeamServiceError: If trying to demote the last owner
            PermissionDenied: If updated_by lacks permission
        """
        # Only owners can change roles
        updater_role = team.get_user_role(updated_by)
        if updater_role != TeamRole.OWNER:
            raise PermissionDenied("Only team owners can change member roles")
        
        membership = TeamMember.objects.filter(
            team=team,
            user=user,
            deleted_at__isnull=True
        ).first()
        
        if not membership:
            raise TeamServiceError("User is not a member of this team")
        
        # Prevent demoting the last owner
        if membership.role == TeamRole.OWNER and new_role != TeamRole.OWNER:
            owner_count = team.get_owners().count()
            if owner_count <= 1:
                raise TeamServiceError(
                    "Cannot demote the last owner. Assign another owner first."
                )
        
        membership.role = new_role
        membership.save(update_fields=["role", "updated_at"])
        
        return membership
    
    @staticmethod
    def leave_team(team: Team, user: "UserType") -> None:
        """
        Allow a user to leave a team voluntarily.
        
        Args:
            team: Team to leave
            user: User leaving the team
            
        Raises:
            TeamServiceError: If user is the last owner
        """
        membership = TeamMember.objects.filter(
            team=team,
            user=user,
            deleted_at__isnull=True
        ).first()
        
        if not membership:
            raise TeamServiceError("You are not a member of this team")
        
        # Prevent last owner from leaving
        if membership.role == TeamRole.OWNER:
            owner_count = team.get_owners().count()
            if owner_count <= 1:
                raise TeamServiceError(
                    "You are the last owner. Assign another owner before leaving."
                )
        
        membership.soft_delete()
        
        # Update team leader if leaving user was the leader
        if team.leader == user:
            new_leader = team.members.filter(
                deleted_at__isnull=True,
                role__in=[TeamRole.OWNER, TeamRole.MANAGER]
            ).first()
            if new_leader:
                team.leader = new_leader.user
                team.save(update_fields=["leader", "updated_at"])
