from django.core.management.base import BaseCommand
from apps.projects.models import Project, ProjectMembership

class Command(BaseCommand):
    help = 'Assigns the creator based on the existing OWNER role in members list'

    def handle(self, *args, **kwargs):
        # 1. Find all projects with NO creator
        projects = Project.objects.filter(created_by__isnull=True)
        count = projects.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS("No projects need fixing."))
            return

        self.stdout.write(f"Found {count} projects. analyzing owners...")

        for project in projects:
            # 2. Look for the member who has role='owner'
            owner_membership = ProjectMembership.objects.filter(
                project=project, 
                role='owner'
            ).first()

            if owner_membership:
                # 3. Assign THAT user as the creator
                project.created_by = owner_membership.user
                project.save()
                self.stdout.write(self.style.SUCCESS(f" - Fixed: '{project.name}' -> Assigned to {owner_membership.user.username}"))
            else:
                # 4. Fallback (Only if NO owner exists at all)
                self.stdout.write(self.style.WARNING(f" - Skipped: '{project.name}' (No owner found)"))

        self.stdout.write(self.style.SUCCESS("Update complete!"))