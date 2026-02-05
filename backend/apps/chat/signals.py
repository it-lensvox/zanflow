"""
Django signals for chat application.

Handles:
- Auto-creation of project chat rooms when project is created
- Auto-adding users to chat room when they join a project
- Auto-removing users from chat room when they leave a project
"""
import logging

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.projects.models import Project, ProjectMembership
from .models import ChatRoom, ChatRoomMembership
from apps.teams.models import Team, TeamMembership
logger = logging.getLogger(__name__)

@receiver(post_save, sender=Team)
def create_team_chat_room(sender, instance, created, **kwargs):
    """Auto-create chat room when a new Team is created."""
    if created:
        try:
            from .services import ChatRoomService
            # Assuming 'created_by' exists on your Team model
            ChatRoomService.create_team_room(instance, instance.created_by)
        except Exception as e:
            logger.error(f"Failed to create team chat: {str(e)}")

@receiver(post_save, sender=TeamMembership)
def add_user_to_team_chat(sender, instance, created, **kwargs):
    """Auto-add user to chat when they join a Team."""
    if created:
        try:
            team = instance.team
            user = instance.user
            
            room = ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.TEAM, 
                team=team
            ).first()
            
            if room:
                from .services import ChatRoomService
                ChatRoomService.add_participant(room, user)
        except Exception as e:
            logger.error(f"Failed to add user to team chat: {str(e)}")

@receiver(post_delete, sender=TeamMembership)
def remove_user_from_team_chat(sender, instance, **kwargs):
    """Auto-remove user from chat when they leave a Team."""
    try:
        team = instance.team
        user = instance.user
        
        room = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.TEAM, 
            team=team
        ).first()
        
        if room:
            from .services import ChatRoomService
            ChatRoomService.remove_participant(room, user)
    except Exception as e:
        logger.error(f"Failed to remove user from team chat: {str(e)}")
@receiver(post_save, sender=Project)
def create_project_chat_room(sender, instance, created, **kwargs):
    """
    Auto-create a chat room when a new project is created.
    
    Triggered: When a new Project is saved for the first time.
    Action: Creates a project-type ChatRoom and adds the creator as admin.
    """
    if created:
        try:
            # Get project creator from UserStampedModel's created_by field
            creator = instance.created_by
            
            if not creator:
                logger.warning(f"Project {instance.id} has no creator, skipping chat room creation")
                return
            
            # Create the chat room for this project
            room = ChatRoom.objects.create(
                name=f"{instance.name}",
                room_type=ChatRoom.RoomType.PROJECT,
                project=instance,
                created_by=creator,
                slug=f"project-{instance.id}",
            )
            
            # Add creator as room admin
            ChatRoomMembership.objects.create(
                room=room,
                user=creator,
                room_role=ChatRoomMembership.RoomRole.ADMIN
            )
            
            logger.info(f"Auto-created chat room '{room.name}' for project {instance.id}")
            
        except Exception as e:
            logger.error(f"Failed to auto-create chat room for project {instance.id}: {str(e)}")


@receiver(post_save, sender=ProjectMembership)
def add_user_to_project_chat(sender, instance, created, **kwargs):
    """
    Auto-add user to project chat room when they are added to a project.
    
    Triggered: When a new ProjectMembership is created.
    Action: Adds the user to the project's ChatRoom.
    """
    if created:
        try:
            project = instance.project
            user = instance.user
            
            # Find the chat room for this project
            room = ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.PROJECT,
                project=project
            ).first()
            
            if not room:
                logger.warning(f"No chat room found for project {project.id}, creating one now")
                # Create room if it doesn't exist (edge case)
                creator = project.created_by or user
                room = ChatRoom.objects.create(
                    name=f"{project.name}",
                    room_type=ChatRoom.RoomType.PROJECT,
                    project=project,
                    created_by=creator,
                    slug=f"project-{project.id}",
                )
            
            # Check if user is already in the room
            if ChatRoomMembership.objects.filter(room=room, user=user).exists():
                logger.debug(f"User {user.id} already in chat room for project {project.id}")
                return
            
            # Map project role to chat room role
            chat_role = ChatRoomMembership.RoomRole.MEMBER
            if instance.role in ['owner', 'admin']:
                chat_role = ChatRoomMembership.RoomRole.ADMIN
            elif instance.role == 'manager':
                chat_role = ChatRoomMembership.RoomRole.MODERATOR
            
            # Add user to chat room
            ChatRoomMembership.objects.create(
                room=room,
                user=user,
                room_role=chat_role
            )
            
            logger.info(f"Added user {user.id} to chat room for project {project.id}")
            
        except Exception as e:
            logger.error(f"Failed to add user to project chat: {str(e)}")


@receiver(post_delete, sender=ProjectMembership)
def remove_user_from_project_chat(sender, instance, **kwargs):
    """
    Auto-remove user from project chat room when they are removed from a project.
    
    Triggered: When a ProjectMembership is deleted.
    Action: Removes the user from the project's ChatRoom.
    """
    try:
        project = instance.project
        user = instance.user
        
        # Find the chat room for this project
        room = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.PROJECT,
            project=project
        ).first()
        
        if not room:
            return
        
        # Remove user from chat room
        deleted_count, _ = ChatRoomMembership.objects.filter(
            room=room,
            user=user
        ).delete()
        
        if deleted_count:
            logger.info(f"Removed user {user.id} from chat room for project {project.id}")
            
    except Exception as e:
        logger.error(f"Failed to remove user from project chat: {str(e)}")


@receiver(post_save, sender=ProjectMembership)
def update_user_chat_role(sender, instance, created, **kwargs):
    """
    Update user's chat room role when their project role changes.
    
    Triggered: When a ProjectMembership is updated (not created).
    Action: Updates the user's role in the project's ChatRoom.
    """
    if not created:  # Only on updates, not creation
        try:
            project = instance.project
            user = instance.user
            
            # Find the chat room for this project
            room = ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.PROJECT,
                project=project
            ).first()
            
            if not room:
                return
            
            # Find user's chat membership
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
            logger.error(f"Failed to update user chat role: {str(e)}")