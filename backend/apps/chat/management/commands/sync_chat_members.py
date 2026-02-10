from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.chat.models import ChatRoom, ChatRoomMembership
from apps.projects.models import Project
from apps.teams.models import Team

User = get_user_model()

class Command(BaseCommand):
    help = 'Syncs Project and Team members to their respective Chat Rooms'

    def get_real_user(self, obj):
        """
        Safely extracts a User instance from either a User object 
        or a Membership object.
        """
        # Case 1: It is already a User instance
        if isinstance(obj, User):
            return obj
        
        # Case 2: It is a Membership object with a 'user' field
        if hasattr(obj, 'user'):
            return obj.user
            
        return None

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting sync...")

        # =========================================================
        # 1. SYNC PROJECTS
        # =========================================================
        projects = Project.objects.all()
        for project in projects:
            # FIX: Now that you fixed the model, we can trust created_by
            # If it's still None for OLD projects, we fallback to the first member
            creator = project.created_by
            
            if not creator:
                # Fallback logic for old broken data
                if hasattr(project, 'members') and project.members.exists():
                    first_member = project.members.first()
                    creator = self.get_real_user(first_member)
            
            if not creator:
                self.stdout.write(f"Skipping Project '{project.name}' - No creator or members found.")
                continue

            # Get/Create Room
            room, created = ChatRoom.objects.get_or_create(
                room_type='project',
                project=project,
                defaults={
                    'name': project.name,
                    'created_by': creator,
                    'slug': f"project-{project.id}"
                }
            )

            # Add Members
            count = 0
            
            # We iterate through whatever relation you have (members or memberships)
            # This loop handles both cases
            sources = []
            if hasattr(project, 'members'): sources.append(project.members.all())
            if hasattr(project, 'memberships'): sources.append(project.memberships.all())
            if hasattr(project, 'projectmembership_set'): sources.append(project.projectmembership_set.all())

            for source in sources:
                for obj in source:
                    # FIX: This function prevents the "ValueError: Must be User instance"
                    real_user = self.get_real_user(obj)
                    
                    if real_user:
                        _, c = ChatRoomMembership.objects.get_or_create(
                            room=room, 
                            user=real_user, 
                            defaults={'room_role': 'member'}
                        )
                        if c: count += 1

            if created or count > 0:
                self.stdout.write(f"Synced Project '{project.name}': Room Created? {created}, Users Added: {count}")

        # =========================================================
        # 2. SYNC TEAMS
        # =========================================================
        teams = Team.objects.all()
        for team in teams:
            creator = getattr(team, 'created_by', None)
            
            if not creator and hasattr(team, 'members') and team.members.exists():
                 creator = self.get_real_user(team.members.first())

            if not creator: continue

            room, created = ChatRoom.objects.get_or_create(
                room_type='team',
                team=team,
                defaults={
                    'name': team.name,
                    'created_by': creator,
                    'slug': f"team-{team.id}"
                }
            )

            count = 0
            sources = []
            if hasattr(team, 'members'): sources.append(team.members.all())
            if hasattr(team, 'memberships'): sources.append(team.memberships.all())
            if hasattr(team, 'teammembership_set'): sources.append(team.teammembership_set.all())

            for source in sources:
                for obj in source:
                    real_user = self.get_real_user(obj)
                    if real_user:
                        _, c = ChatRoomMembership.objects.get_or_create(
                            room=room, 
                            user=real_user, 
                            defaults={'room_role': 'member'}
                        )
                        if c: count += 1
            
            if created or count > 0:
                self.stdout.write(f"Synced Team '{team.name}': Users Added: {count}")

        self.stdout.write(self.style.SUCCESS("Sync complete!"))