from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.projects.models import Project
from .models import Folder

@receiver(post_save, sender=Project, dispatch_uid="bind_project_tasks_folder_unique")
def create_project_system_folders(sender, instance, created, **kwargs):
    if created:
        # Get the organization ID safely
        org_id = getattr(instance, 'organization_id', None) or getattr(instance.created_by, 'organization_id', None)
        
        # DEFENSIVE FIX: get_or_create absolutely prevents duplicates
        folder, folder_created = Folder.objects.get_or_create(
            project=instance,
            name="Tasks",
            is_system_generated=True,
            defaults={
                "created_by": instance.created_by,
                "organization_id": org_id
            }
        )
        
        if folder_created:
            print(f"--- FOLDER CREATED & BOUND TO ORG ID: {org_id} ---")
        else:
            print("--- FOLDER ALREADY EXISTED (Signal duplicate prevented) ---")