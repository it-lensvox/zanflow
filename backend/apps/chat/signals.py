"""
Django signals for chat application.

Handles:
- Auto-creation of project chat rooms when project is created
- Auto-adding users to chat room when they join a project
- Auto-removing users from chat room when they leave a project
- Auto-creation of team chat rooms when team is created
- Team chat room soft-deletion when team is deleted
"""
import logging

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.projects.models import Project, ProjectMembership
# from apps.teams.models import Team, TeamMembership
from apps.teams.models import Team, TeamMember
from .models import ChatRoom, ChatRoomMembership

logger = logging.getLogger(__name__)


# =============================================================================
# TEAM SIGNALS
# =============================================================================

@receiver(post_save, sender=Team)
def create_team_chat_room(sender, instance, created, **kwargs):
    """Auto-create chat room when a new Team is created."""
    if created:
        try:
            # Create the chat room
            room, room_created = ChatRoom.objects.get_or_create(
                room_type=ChatRoom.RoomType.TEAM,
                team=instance,
                defaults={
                    'name': f"{instance.name} Chat",
                    'created_by': getattr(instance, 'created_by', None),
                    'slug': f"team-{instance.id}",
                }
            )
            
            if room_created:
                logger.info(f"Auto-created team chat room '{room.name}' for team {instance.id}")
                
                # Add creator as admin if they exist
                creator = getattr(instance, 'created_by', None)
                if creator:
                    ChatRoomMembership.objects.get_or_create(
                        room=room,
                        user=creator,
                        defaults={'room_role': ChatRoomMembership.RoomRole.ADMIN}
                    )
                    
        except Exception as e:
            logger.error(f"Failed to create team chat room for team {instance.id}: {str(e)}", exc_info=True)


@receiver(post_save, sender=Team)
def sync_chat_with_team_deletion(sender, instance, **kwargs):
    """
    When a Team is soft-deleted (deleted_at is set), 
    hide the associated ChatRoom by setting is_active=False.
    """
    if hasattr(instance, 'deleted_at') and instance.deleted_at is not None:
        try:
            ChatRoom.objects.filter(
                team=instance,
                room_type=ChatRoom.RoomType.TEAM
            ).update(is_active=False)
            logger.info(f"Deactivated chat room for soft-deleted team {instance.id}")
        except Exception as e:
            logger.error(f"Failed to deactivate team chat room: {str(e)}", exc_info=True)


@receiver(post_save, sender=TeamMember)
def add_user_to_team_chat(sender, instance, created, **kwargs):
    """Auto-add user to chat when they join a Team."""
    if created:
        try:
            # Note: In your models.py, the field is 'team', not 'team_id'
            team = instance.team 
            user = instance.user
            
            room = ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.TEAM, 
                team=team,
                is_active=True
            ).first()
            
            if not room:
                logger.warning(f"Team chat room not found for team {team.id}, creating now...")
                room, _ = ChatRoom.objects.get_or_create(
                    room_type=ChatRoom.RoomType.TEAM,
                    team=team,
                    defaults={
                        'name': f"{team.name} Chat",
                        'created_by': user,
                        'slug': f"team-{team.id}",
                    }
                )
            
            # Add user to chat room if not already a member
            if room and not ChatRoomMembership.objects.filter(room=room, user=user).exists():
                # Determine chat role based on team role
                chat_role = ChatRoomMembership.RoomRole.MEMBER
                team_role = getattr(instance, 'role', 'member')
                
                if team_role in ['owner', 'admin']:
                    chat_role = ChatRoomMembership.RoomRole.ADMIN
                elif team_role == 'manager':
                    chat_role = ChatRoomMembership.RoomRole.MODERATOR
                
                ChatRoomMembership.objects.create(
                    room=room,
                    user=user,
                    room_role=chat_role
                )
                logger.info(f"Added user {user.id} to team chat room for team {team.id}")
                
        except Exception as e:
            logger.error(f"Failed to add user to team chat: {str(e)}", exc_info=True)


@receiver(post_delete, sender=TeamMember)
def remove_user_from_team_chat(sender, instance, **kwargs):
    """Auto-remove user from chat when they leave a Team."""
    try:
        team = instance.team
        user = instance.user
        
        room = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.TEAM, 
            team=team,
            is_active=True
        ).first()
        
        if room:
            deleted_count, _ = ChatRoomMembership.objects.filter(
                room=room,
                user=user
            ).delete()
            
            if deleted_count:
                logger.info(f"Removed user {user.id} from team chat room for team {team.id}")
                
    except Exception as e:
        logger.error(f"Failed to remove user from team chat: {str(e)}", exc_info=True)


# =============================================================================
# PROJECT SIGNALS
# =============================================================================

@receiver(post_save, sender=Project)
def create_project_chat_room(sender, instance, created, **kwargs):
    """Auto-create a chat room when a new project is created."""
    if created:
        try:
            creator = getattr(instance, 'created_by', None)
            
            room, room_created = ChatRoom.objects.get_or_create(
                room_type=ChatRoom.RoomType.PROJECT,
                project=instance,
                defaults={
                    'name': f"{instance.name} Chat",
                    'created_by': creator,
                    'slug': f"project-{instance.id}",
                }
            )
            
            if room_created:
                logger.info(f"Auto-created chat room '{room.name}' for project {instance.id}")
                
                # Add creator as admin if they exist
                if creator:
                    ChatRoomMembership.objects.get_or_create(
                        room=room,
                        user=creator,
                        defaults={'room_role': ChatRoomMembership.RoomRole.ADMIN}
                    )
            
        except Exception as e:
            logger.error(f"Failed to auto-create chat room for project {instance.id}: {str(e)}", exc_info=True)


@receiver(post_save, sender=ProjectMembership)
def add_user_to_project_chat(sender, instance, created, **kwargs):
    """Auto-add user to project chat room when they are added to a project."""
    if created:
        try:
            project = instance.project
            user = instance.user
            
            # Find the chat room
            room = ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.PROJECT,
                project=project,
                is_active=True
            ).first()
            
            # If room doesn't exist, create it
            if not room:
                logger.warning(f"Project chat room not found for project {project.id}, creating now...")
                creator = getattr(project, 'created_by', user)
                room, _ = ChatRoom.objects.get_or_create(
                    room_type=ChatRoom.RoomType.PROJECT,
                    project=project,
                    defaults={
                        'name': f"{project.name} Chat",
                        'created_by': creator,
                        'slug': f"project-{project.id}",
                    }
                )

            # Add user to room if not already there
            if room and not ChatRoomMembership.objects.filter(room=room, user=user).exists():
                # Map role
                chat_role = ChatRoomMembership.RoomRole.MEMBER
                role = getattr(instance, 'role', 'member')
                
                if role in ['owner', 'admin']:
                    chat_role = ChatRoomMembership.RoomRole.ADMIN
                elif role == 'manager':
                    chat_role = ChatRoomMembership.RoomRole.MODERATOR
                
                ChatRoomMembership.objects.create(
                    room=room,
                    user=user,
                    room_role=chat_role
                )
                logger.info(f"Added user {user.id} to chat room for project {project.id}")
            
        except Exception as e:
            logger.error(f"Failed to add user to project chat: {str(e)}", exc_info=True)


@receiver(post_delete, sender=ProjectMembership)
def remove_user_from_project_chat(sender, instance, **kwargs):
    """Auto-remove user from project chat room when they are removed from a project."""
    try:
        project = instance.project
        user = instance.user
        
        room = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.PROJECT,
            project=project,
            is_active=True
        ).first()
        
        if room:
            deleted_count, _ = ChatRoomMembership.objects.filter(
                room=room,
                user=user
            ).delete()
            
            if deleted_count:
                logger.info(f"Removed user {user.id} from chat room for project {project.id}")
                
    except Exception as e:
        logger.error(f"Failed to remove user from project chat: {str(e)}", exc_info=True)


@receiver(post_save, sender=ProjectMembership)
def update_user_chat_role(sender, instance, created, **kwargs):
    """Update user's chat room role when their project role changes."""
    if not created:  # Only on updates, not creation
        try:
            project = instance.project
            user = instance.user
            
            room = ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.PROJECT,
                project=project,
                is_active=True
            ).first()
            
            if not room:
                return
            
            chat_membership = ChatRoomMembership.objects.filter(
                room=room,
                user=user
            ).first()
            
            if not chat_membership:
                return
            
            # Map project role to chat room role
            new_chat_role = ChatRoomMembership.RoomRole.MEMBER
            if instance.role in ['owner', 'admin']:
                new_chat_role = ChatRoomMembership.RoomRole.ADMIN
            elif instance.role == 'manager':
                new_chat_role = ChatRoomMembership.RoomRole.MODERATOR
            
            # Update if role changed
            if chat_membership.room_role != new_chat_role:
                chat_membership.room_role = new_chat_role
                chat_membership.save(update_fields=['room_role'])
                logger.info(f"Updated chat role for user {user.id} in project {project.id}")
                
        except Exception as e:
            logger.error(f"Failed to update user chat role: {str(e)}", exc_info=True)