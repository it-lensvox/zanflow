"""
Django signals for the teams app.
Handles automatic updates and side effects.
"""
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Team, TeamMember, TeamRole
# Import ChatRoom from your chat app
# Adjust 'apps.chat.models' if your app name is different
from apps.chat.models import ChatRoom 
from apps.chat.services import ChatRoomService

logger = logging.getLogger(__name__)

# ==========================================
# 1. Existing Leader Logic (Keep this)
# ==========================================

@receiver(post_save, sender=TeamMember)
def update_team_leader_on_member_save(sender, instance, created, **kwargs):
    """
    Update team leader when membership changes.
    If the team has no leader and a new owner is added, set them as leader.
    """
    if instance.deleted_at is not None:
        return
    
    team = instance.team
    
    # If team has no leader and this is an owner, set as leader
    if not team.leader and instance.role == TeamRole.OWNER:
        team.leader = instance.user
        team.save(update_fields=["leader", "updated_at"])


@receiver(post_delete, sender=TeamMember)
def update_team_leader_on_member_delete(sender, instance, **kwargs):
    """
    Update team leader when a member is hard deleted.
    """
    team = instance.team
    
    if team.leader == instance.user:
        # Find a new leader
        new_leader_membership = TeamMember.objects.filter(
            team=team,
            deleted_at__isnull=True,
            role__in=[TeamRole.OWNER, TeamRole.MANAGER]
        ).first()
        
        if new_leader_membership:
            team.leader = new_leader_membership.user
        else:
            team.leader = None
        
        team.save(update_fields=["leader", "updated_at"])


# ==========================================
# 2. NEW Chat Room Logic (Add this)
# ==========================================

@receiver(post_save, sender=Team)
def create_team_chat_room(sender, instance, created, **kwargs):
    """
    Auto-create a chat room when a new Team is created.
    """
    if created:
        try:
            # Fallback: if no leader is set, use the creator or the first admin found
            creator = instance.leader or instance.members.first().user
            ChatRoomService.create_team_room(instance, creator)
            logger.info(f"Chat room created for team: {instance.name}")
        except Exception as e:
            logger.error(f"Failed to create team chat: {str(e)}")

@receiver(post_save, sender=TeamMember)
def add_user_to_team_chat(sender, instance, created, **kwargs):
    """
    Auto-add user to the chat room when they join a Team.
    """
    if created and instance.deleted_at is None:
        try:
            team = instance.team
            user = instance.user
            
            # Find the chat room linked to this team
            room = ChatRoom.objects.filter(
                room_type=ChatRoom.RoomType.TEAM, 
                team=team
            ).first()
            
            if room:
                ChatRoomService.add_participant(room, user)
        except Exception as e:
            logger.error(f"Failed to add user to team chat: {str(e)}")