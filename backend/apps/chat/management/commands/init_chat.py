"""
Management command to initialize the chat system.

Usage:
    python manage.py init_chat
    python manage.py init_chat --create-project-rooms
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from apps.chat.models import ChatRoom
from apps.chat.services import ChatRoomService

User = get_user_model()


class Command(BaseCommand):
    help = 'Initialize the chat system by creating default rooms'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-project-rooms',
            action='store_true',
            help='Create chat rooms for existing projects',
        )
        parser.add_argument(
            '--admin-username',
            type=str,
            default=None,
            help='Username of admin user to create rooms (defaults to first superuser)',
        )

    def handle(self, *args, **options):
        self.stdout.write('Initializing chat system...')
        
        # Get admin user
        admin_user = None
        
        if options['admin_username']:
            try:
                admin_user = User.objects.get(username=options['admin_username'])
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"User '{options['admin_username']}' not found")
                )
                return
        else:
            admin_user = User.objects.filter(is_superuser=True).first()
            
            if not admin_user:
                admin_user = User.objects.first()
        
        if not admin_user:
            self.stdout.write(
                self.style.ERROR('No users found. Create a user first.')
            )
            return
        
        self.stdout.write(f'Using user: {admin_user.username}')
        
        # Create global chat room
        self.create_global_room(admin_user)
        
        # Optionally create project rooms
        if options['create_project_rooms']:
            self.create_project_rooms(admin_user)
        
        self.stdout.write(self.style.SUCCESS('Chat system initialized successfully!'))

    def create_global_room(self, admin_user):
        """Create the global chat room."""
        existing = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.GLOBAL
        ).first()
        
        if existing:
            self.stdout.write(f'Global room already exists: {existing.name}')
            return existing
        
        room = ChatRoomService.create_global_room(
            name='Global Chat',
            created_by=admin_user
        )
        
        self.stdout.write(
            self.style.SUCCESS(f'Created global room: {room.name} (slug: {room.slug})')
        )
        
        return room

    def create_project_rooms(self, admin_user):
        """Create chat rooms for existing projects."""
        try:
            from apps.projects.models import Project
            
            projects = Project.objects.filter(is_active=True)
            created_count = 0
            
            for project in projects:
                existing = ChatRoom.objects.filter(
                    room_type=ChatRoom.RoomType.PROJECT,
                    project=project
                ).exists()
                
                if not existing:
                    room = ChatRoomService.create_project_room(project, admin_user)
                    self.stdout.write(f'  Created room for project: {project.name}')
                    created_count += 1
            
            self.stdout.write(
                self.style.SUCCESS(f'Created {created_count} project rooms')
            )
            
        except ImportError:
            self.stdout.write(
                self.style.WARNING('Projects app not found, skipping project rooms')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating project rooms: {str(e)}')
            )
