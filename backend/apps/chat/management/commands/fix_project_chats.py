from django.core.management.base import BaseCommand
from django.db import transaction
from apps.projects.models import Project
from apps.chat.models import ChatRoom, ChatRoomMembership
from apps.chat.services import ChatRoomService

class Command(BaseCommand):
    help = 'Safely backfills missing chat rooms and members for existing projects.'

    def handle(self, *args, **kwargs):
        self.stdout.write("--- Starting Safe Chat Backfill ---")
        
        projects = Project.objects.all()
        count_created = 0
        count_updated = 0

        for project in projects:
            try:
                with transaction.atomic():
                    # 1. Get or Create the Room
                    room, created = ChatRoom.objects.get_or_create(
                        room_type=ChatRoom.RoomType.PROJECT,
                        project=project,
                        defaults={
                            'name': project.name,
                            # Fallback logic for creator
                            'created_by': project.created_by or self.get_fallback_user(project),
                            'slug': f"project-{project.id}"
                        }
                    )

                    if created:
                        self.stdout.write(self.style.SUCCESS(f"[CREATED] Room for: {project.name}"))
                        count_created += 1

                    # 2. Sync Members to Chat
                    if hasattr(project, 'members'):
                        # FIX: Loop directly over users, don't look for .user attribute
                        for user in project.members.all():
                            
                            # Check if user is already in the room
                            if not ChatRoomMembership.objects.filter(room=room, user=user).exists():
                                ChatRoomService.add_participant(room, user)
                                self.stdout.write(f"   -> Added missing member: {user.email}")
                                count_updated += 1
                    
                    # 3. Ensure Project Leader is in Chat
                    if hasattr(project, 'leader') and project.leader:
                        if not ChatRoomMembership.objects.filter(room=room, user=project.leader).exists():
                            ChatRoomService.add_participant(room, project.leader)
                            self.stdout.write(f"   -> Added leader: {project.leader.email}")
                            count_updated += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error processing {project.name}: {str(e)}"))

        self.stdout.write(self.style.SUCCESS(f"--- Done. Created {count_created} rooms, Added {count_updated} members. ---"))

    def get_fallback_user(self, project):
        """Helper to find a valid user if project.created_by is missing"""
        if hasattr(project, 'members') and project.members.exists():
            # FIX: Return the user directly
            return project.members.first()
        if hasattr(project, 'leader') and project.leader:
            return project.leader
        return None