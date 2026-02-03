"""
Django signals for the teams app.
Handles automatic updates and side effects.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import TeamMember, TeamRole


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
