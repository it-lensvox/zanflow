from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
import logging

logger = logging.getLogger(__name__)
DEFAULT_NOTE_FOLDERS = ["Personal Update", "Team Member Update"]

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_default_note_folders(sender, instance, created, **kwargs):
    if not created:
        return

    from apps.quicknotes.models import Folder
    for folder_name in DEFAULT_NOTE_FOLDERS:
        try:
            Folder.objects.get_or_create(
                user=instance,
                name=folder_name,
                defaults={'organization': None, 'workspace': None}
            )
        except Exception as e:
            logger.error(f"Failed to create default folder '{folder_name}' for user {instance.pk}: {e}")