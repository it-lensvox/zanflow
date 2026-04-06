from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.utils.timezone import localtime
from django.db.models import Q
from apps.quicknotes.models import Folder, Note

User = get_user_model()

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
        
        personal_title = f"Personal Update - {instance.date}"
        personal_note = Note.objects.filter(user=instance.user, folder=personal_folder, title=personal_title).first()
        
        if personal_note:
            personal_note.content = instance.content
            personal_note.save()
        else:
            Note.objects.create(
                user=instance.user,
                folder=personal_folder,
                title=personal_title,
                content=instance.content
            )

        # ==========================================
        # 2. TEAM MEMBER UPDATES FOR ADMINS & MANAGERS
        # ==========================================
        all_updates_today = sender.objects.filter(date=instance.date).select_related('user').order_by('created_at')
        
        team_content = f"Team Updates for {instance.date}\n"
        team_content += "=" * 40 + "\n\n"
        
        for update in all_updates_today:
            post_time = localtime(update.created_at).strftime('%I:%M %p')
            user_name = update.user.get_full_name() or update.user.username
            
            team_content += f"👤 {user_name} (Posted at: {post_time})\n"
            team_content += f"{update.content}\n"
            team_content += "-" * 40 + "\n\n"

        leadership_users = User.objects.filter(
            Q(role__in=['admin', 'manager']) | Q(is_superuser=True)
        ).distinct()

        for leader in leadership_users:
            leader_folder, _ = Folder.objects.get_or_create(
                name="Daily Updates",
                user=leader
            )
            
            team_title = f"Team Member Updates - {instance.date}"
            team_note = Note.objects.filter(user=leader, folder=leader_folder, title=team_title).first()
            
            if team_note:
                team_note.content = team_content
                team_note.save()
            else:
                Note.objects.create(
                    user=leader,
                    folder=leader_folder,
                    title=team_title,
                    content=team_content
                )

    except Exception as e:
        print(f"Error in QuickNotes Signal: {e}")