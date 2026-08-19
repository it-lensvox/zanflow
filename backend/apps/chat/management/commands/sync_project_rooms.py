from django.core.management.base import BaseCommand
from apps.projects.models import Project
from apps.chat.models import ChatRoom
from apps.chat.services import ChatRoomService

class Command(BaseCommand):
    help = 'Creates missing chat rooms for existing projects'

    def handle(self, *args, **options):
        self.stdout.write("Checking for projects without chat rooms...")
        
        projects = Project.objects.all()
        created_count = 0
        skipped_count = 0

        for project in projects:
            # Check if a PROJECT type room already exists for this project
            exists = ChatRoom.objects.filter(
                project=project, 
                room_type=ChatRoom.RoomType.PROJECT
            ).exists()

            if exists:
                skipped_count += 1
                continue

            self.stdout.write(f"Creating missing room for project: {project.name} (ID: {project.id})")
            
            try:
                # We reuse the logic from your Service to ensure members are added automatically
                #
                creator = getattr(project, 'created_by', None)
                
                # This service method handles:
                # 1. Creating the room
                # 2. Adding the creator as Admin
                # 3. Adding existing project members to the chat
                ChatRoomService.create_project_room(project, creator)
                
                created_count += 1
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"Failed to create room for project {project.id}: {str(e)}"
                ))

        self.stdout.write(self.style.SUCCESS(
            f"Done! Created {created_count} rooms. Skipped {skipped_count} existing rooms."
        ))