from django.db.models.signals import post_save, m2m_changed, post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.utils.timezone import localtime
from django.db.models import Q
from apps.quicknotes.models import Folder, Note
from apps.notification.services import notify_event_created, notify_calendar_shared
from .models import Event, EventInvitation, CalendarShare
User = get_user_model()

@receiver(post_save, sender=CalendarShare)
def send_calendar_share_notification(sender, instance, created, **kwargs):
    """
    Trigger notifications when a user shares their calendar with a teammate.
    """
    # We only want to notify them when the share is first CREATED, 
    # not every time the permission is updated later.
    if created:
        try:
            # Trigger your real-time notification service
            notify_calendar_shared(
                share_record=instance,  # Pass the entire instance here
                actor=instance.owner    # Pass the owner as the actor
            )
        except Exception as e:
            # Catching the exception ensures that if the notification system fails,
            # it doesn't crash the actual API request that created the calendar share.
            print(f"Error sending calendar share notification: {e}")
@receiver(post_save, sender='daily_updates.DailyUpdate')
def sync_daily_update_to_quick_notes(sender, instance, created, **kwargs):
    try:
        # ==========================================
        # 1. PERSONAL UPDATE FOR THE CREATOR
        # ==========================================
        personal_folder, _ = Folder.objects.get_or_create(
            name="Daily Updates",
            user=instance.user 
        )
        
        # Fetch ALL personal updates for this user to rebuild the master file
        all_personal_updates = sender.objects.filter(user=instance.user).order_by('-date', '-created_at')
        personal_content = ""
        
        for upd in all_personal_updates:
            personal_content += f"## {upd.date}\n\n{upd.content}\n\n---\n\n"
        
        personal_title = "Personal Update"
        personal_note = Note.objects.filter(user=instance.user, folder=personal_folder, title=personal_title).first()
        
        if personal_note:
            personal_note.content = personal_content.strip()
            personal_note.save()
        else:
            Note.objects.create(
                user=instance.user,
                folder=personal_folder,
                title=personal_title,
                content=personal_content.strip()
            )

        # ==========================================
        # 2. TEAM MEMBER UPDATES FOR ADMINS & MANAGERS
        # ==========================================
        
        # Fetch ALL team updates for the organization to rebuild the master file
        all_team_updates = sender.objects.filter(
            user__organization=instance.user.organization 
        ).select_related('user').order_by('-date', '-created_at')
        
        team_content = ""
        current_date = None
        
        for update in all_team_updates:
            # Add date heading only when the date changes in our loop
            if update.date != current_date:
                team_content += f"## {update.date}\n"
                team_content += "=" * 40 + "\n\n"
                current_date = update.date
            
            post_time = localtime(update.created_at).strftime('%I:%M %p')
            user_name = update.user.get_full_name() or update.user.username
            
            team_content += f"👤 {user_name} (Posted at: {post_time})\n"
            team_content += f"{update.content}\n"
            team_content += "-" * 40 + "\n\n"

        # Only fetch leaders from the same organization
        leadership_users = User.objects.filter(
            Q(role__in=['admin', 'manager']) | Q(is_superuser=True),
            organization=instance.user.organization 
        ).distinct()

        for leader in leadership_users:
            leader_folder, _ = Folder.objects.get_or_create(
                name="Daily Updates",
                user=leader
            )
            
            team_title = "Team Member Updates"
            team_note = Note.objects.filter(user=leader, folder=leader_folder, title=team_title).first()
            
            if team_note:
                team_note.content = team_content.strip()
                team_note.save()
            else:
                Note.objects.create(
                    user=leader,
                    folder=leader_folder,
                    title=team_title,
                    content=team_content.strip()
                )

    except Exception as e:
        print(f"Error in QuickNotes Signal: {e}")

@receiver(m2m_changed, sender=Event.attendees.through)
def event_attendees_changed(sender, instance, action, pk_set, **kwargs):
    """
    Trigger notifications when users are assigned to an Event.
    """
    # We only want to trigger notifications AFTER users are successfully added
    if action == "post_add" and pk_set:
        
        # Get the actual user objects that were just added
        added_users = list(User.objects.filter(pk__in=pk_set))
        
        # Determine the actor (who created the event)
        # Change 'created_by' if your Event model uses a different field for the owner/creator
        actor = getattr(instance, 'created_by', None)
        
        # Trigger the real-time notification
        notify_event_created(
            event=instance,
            actor=actor,
            attendees=added_users
        )
@receiver(post_save, sender=EventInvitation)
def send_rsvp_notification(sender, instance, created, **kwargs):
    """
    Trigger notifications when an invitation is created for an Event.
    """
    # Only send the notification if this is a brand new, pending invitation
    if created and instance.status == 'PENDING':
        actor = getattr(instance.event, 'organizer', None)
        
        # We pass the specific user in a list to keep compatibility with your 
        # existing service, but we also pass the invitation instance itself!
        notify_event_created(
            event=instance.event,
            actor=actor,
            attendees=[instance.user], 
            invitation=instance  # <--- CRUCIAL: Make sure to update your service to accept this!
        )