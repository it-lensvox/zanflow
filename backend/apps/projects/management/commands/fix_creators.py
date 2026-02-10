from django.core.management.base import BaseCommand
from apps.projects.models import Project
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = 'Assigns a default creator to projects that have created_by=NULL'

    def handle(self, *args, **kwargs):
        User = get_user_model()
        
        # CHANGE THIS ID if your admin ID on the server is different (e.g., 1 or 2)
        ADMIN_ID = 1 
        
        try:
            admin_user = User.objects.get(id=ADMIN_ID)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User with ID {ADMIN_ID} not found!"))
            return

        projects = Project.objects.filter(created_by__isnull=True)
        count = projects.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS("No projects need fixing."))
            return

        self.stdout.write(f"Found {count} projects with missing creator. Updating...")

        for project in projects:
            project.created_by = admin_user
            project.save()
            self.stdout.write(f" - Fixed: {project.name}")

        self.stdout.write(self.style.SUCCESS(f"Successfully updated {count} projects!"))