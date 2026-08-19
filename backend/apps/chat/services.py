"""
Chat services layer.

Handles all business logic for chat operations:
- Room creation and management
- Message sending and retrieval
- Notification integration
- Access control
"""
import logging
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
import json
import boto3
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Max, Count, Subquery, OuterRef, Exists
from django.utils import timezone

from .models import ChatRoom, ChatMessage, ChatRoomMembership, MessageReadStatus
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .utils import fetch_link_preview
logger = logging.getLogger(__name__)
User = get_user_model()


class ChatRoomService:
    """
    Service class for ChatRoom operations.
    """
    @staticmethod
    @transaction.atomic
    def get_or_create_ai_room(user) -> ChatRoom:
        """
        Get or create a dedicated 1-on-1 AI assistant room for the user.
        """
        room, created = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.AI_BOT,
            created_by=user,
            defaults={
                'name': 'Zanflow AI Assistant',
                'slug': f'ai-bot-{user.id}',
            }
        )
        
        if created:
            # Add the user to their personal bot room
            ChatRoomService.add_participant(room, user, 'admin')
            logger.info(f"AI Bot room created for user {user.id}: {room.id}")
            
        return room
    
    @staticmethod
    @transaction.atomic
    def create_global_room(name: str, created_by) -> ChatRoom:
        """
        Create or get the global chat room.
        Only one global room should exist.
        
        Args:
            name: Display name for the room
            created_by: User creating the room
            
        Returns:
            ChatRoom instance
        """
        room, created = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.GLOBAL,
            defaults={
                'name': name,
                'created_by': created_by,
                'slug': 'global-chat',
            }
        )
        
        if created:
            logger.info(f"Global chat room created: {room.id}")
        
        return room
    @staticmethod
    def get_total_unread_count(user) -> int:
        """
        Helper to calculate total unread messages across all rooms.
        """
        # We reuse the existing logic to ensure consistency
        rooms_data = ChatRoomService.get_user_rooms(user)
        return sum(room['unread_count'] for room in rooms_data)
    @staticmethod
    def get_unread_counts_breakdown(user) -> dict:
        """Helper to calculate separated unread counts."""
        rooms_data = ChatRoomService.get_user_rooms(user)
        
        # Calculate separately
        thread_unread = sum(r['unread_count'] for r in rooms_data if r['room_type'] == 'thread')
        normal_chat_unread = sum(r['unread_count'] for r in rooms_data if r['room_type'] != 'thread')
        
        return {
            "total_unread": normal_chat_unread,  # ONLY normal chats
            "thread_unread": thread_unread       # ONLY threads
        }
    @staticmethod
    @transaction.atomic
    def create_project_room(project, created_by) -> ChatRoom:
        """
        Create or get a project-specific chat room.
        
        Args:
            project: Project model instance
            created_by: User creating the room
            
        Returns:
            ChatRoom instance
        """
        room, created = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.PROJECT,
            project=project,
            defaults={
                'name': f"{project.name} Chat",
                'created_by': created_by,
                'slug': f"project-{project.id}",
            }
        )
        
        if created:
            logger.info(f"Project chat room created for project {project.id}: {room.id}")
            
            # Add project members as participants
            # Assuming Project has a members field or similar
            if hasattr(project, 'members'):
                for member in project.members.all():
                    ChatRoomService.add_participant(room, member)
            
            # Always add the creator
            ChatRoomService.add_participant(room, created_by)
        
        return room
    @staticmethod
    @transaction.atomic
    def create_team_room(team, created_by) -> ChatRoom:
        """
        Create or get a team-specific chat room.
        """
        room, created = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.TEAM,
            team=team,
            defaults={
                'name': f"{team.name} Chat",
                'created_by': created_by,
                'slug': f"team-{team.id}",
            }
        )
        
        if created:
            # Auto-add existing team members
            if hasattr(team, 'members'):
                for member in team.members.all():
                    ChatRoomService.add_participant(room, member.user)
            
            # Always add the creator
            ChatRoomService.add_participant(room, created_by, 'admin')
        
        return room
    @staticmethod
    @transaction.atomic
    def get_or_create_private_room(user1, user2) -> Tuple[ChatRoom, bool]:
        """
        Get or create a private chat room between two users.
        
        Args:
            user1: First user
            user2: Second user
            
        Returns:
            Tuple of (ChatRoom instance, created boolean)
        """
        # Check for existing room with both participants
        existing_room = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.PRIVATE,
            participants=user1
        ).filter(
            participants=user2
        ).first()
        
        if existing_room:
            return existing_room, False
        
        # Create new private room
        room = ChatRoom.objects.create(
            room_type=ChatRoom.RoomType.PRIVATE,
            name=f"Chat: {user1.username} & {user2.username}",
            created_by=user1,
        )
        
        # Add both participants
        ChatRoomMembership.objects.create(user=user1, room=room)
        ChatRoomMembership.objects.create(user=user2, room=room)
        
        logger.info(f"Private room created between {user1.id} and {user2.id}: {room.id}")
        
        return room, True
    @staticmethod
    @transaction.atomic
    def create_thread_room(project, name: str, created_by, parent_message_id=None) -> ChatRoom:
        """
        Create a thread room linked to a specific project and auto-add all project members.
        """
        parent_message = None
        if parent_message_id:
            parent_message = ChatMessage.objects.filter(id=parent_message_id).first()

        # 1. Create the standalone thread
        room = ChatRoom.objects.create(
            room_type=ChatRoom.RoomType.THREAD,
            project=project,
            name=name,
            created_by=created_by,
            parent_message=parent_message
        )
        
        # 2. Add the person who started the thread
        ChatRoomService.add_participant(room, created_by)
        
        # 3. ---> NEW: Auto-add ALL project members to this thread <---4
        # (Change 'members' to whatever your Project model uses to store its users)
        if hasattr(project, 'members'): 
            for member in project.members.all():
                # Don't add the creator twice
                if member.id != created_by.id: 
                    ChatRoomService.add_participant(room, member)
            
        logger.info(f"Thread room '{name}' created for project {project.id}: {room.id}")
        return room
    @staticmethod
    def delete_room(room: ChatRoom, user) -> bool:
        """
        Soft delete a chat room (thread) by setting is_active to False.
        """
        # Check permissions: Only the creator or a system admin can delete the thread
        if room.created_by_id != user.id and not (hasattr(user, 'role') and user.role == 'admin'):
            return False
        
        room.is_active = False
        room.save(update_fields=['is_active'])
        logger.info(f"Room/Thread {room.id} soft-deleted by user {user.id}")
        return True
    @staticmethod
    def add_participant(room: ChatRoom, user, room_role: str = 'member') -> ChatRoomMembership:
        """
        Add a user to a chat room.
        
        Args:
            room: ChatRoom instance
            user: User to add
            room_role: Role within the room
            
        Returns:
            ChatRoomMembership instance
        """
        membership, created = ChatRoomMembership.objects.get_or_create(
            room=room,
            user=user,
            defaults={'room_role': room_role}
        )
        
        if created:
            logger.debug(f"User {user.id} added to room {room.id}")
        
        return membership

    @staticmethod
    def remove_participant(room: ChatRoom, user) -> bool:
        """
        Remove a user from a chat room.
        
        Args:
            room: ChatRoom instance
            user: User to remove
            
        Returns:
            Boolean indicating success
        """
        deleted, _ = ChatRoomMembership.objects.filter(
            room=room,
            user=user
        ).delete()
        
        if deleted:
            logger.debug(f"User {user.id} removed from room {room.id}")
        
        return deleted > 0

    @staticmethod
    def get_user_rooms(user, room_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all chat rooms for a user with unread counts.
        
        Args:
            user: User instance
            room_type: Optional filter by room type
            
        Returns:
            List of room dictionaries with metadata
        """
        # Base query for rooms user has access to
        rooms_query = ChatRoom.objects.filter(is_active=True)
        
        if room_type:
            rooms_query = rooms_query.filter(room_type=room_type)
        
        # Filter based on room type
        rooms_query = rooms_query.filter(
            Q(room_type=ChatRoom.RoomType.GLOBAL) |
            Q(participants=user)
        ).distinct()
        
        # Annotate with last message and unread count
        rooms = []
        for room in rooms_query:
            # Get last message
            last_message = room.messages.filter(
                is_deleted=False
            ).order_by('-created_at').first()
            
            # Get unread count for non-global rooms
            unread_count = 0
            if room.room_type != ChatRoom.RoomType.GLOBAL:
                membership = ChatRoomMembership.objects.filter(
                    room=room, user=user
                ).first()
                
                if membership:
                    unread_count = room.messages.filter(
                        is_deleted=False,
                        created_at__gt=membership.last_read_at
                    ).exclude(sender=user).count()
            
            rooms.append({
                'id': str(room.id),
                'name': room.name,
                'room_type': room.room_type,
                'slug': room.slug,
                'project_id': str(room.project_id) if room.project_id else None,
                'last_message': last_message.to_websocket_dict() if last_message else None,
                'unread_count': unread_count,
                'updated_at': room.updated_at.isoformat(),
            })
        
        # Sort by last message time
        rooms.sort(key=lambda x: x['last_message']['created_at'] if x['last_message'] else '', reverse=True)
        
        return rooms

    @staticmethod
    def check_room_access(room: ChatRoom, user) -> bool:
        """
        Check if a user has access to a room.
        Uses role-based access from existing user model.
        
        Args:
            room: ChatRoom instance
            user: User to check
            
        Returns:
            Boolean indicating access permission
        """
        # Anonymous users have no access
        if not user or not user.is_authenticated:
            return False
        
        # Global chat - all authenticated users
        if room.room_type == ChatRoom.RoomType.GLOBAL:
            return True
        
        # Admin users have access to all rooms
        if hasattr(user, 'role') and user.role == 'admin':
            return True
        
        # Check membership for private and project rooms
        return room.is_participant(user)


class ChatMessageService:
    """
    Service class for ChatMessage operations.
    """
    
    @staticmethod
    @transaction.atomic
    def create_message(room, sender, content, message_type='text', attachment=None, attachment_name='', reply_to_id=None, is_ai_generated=False): # <-- ADD IT HERE
        try:
            # 1. Save to DB
            message = ChatMessage.objects.create(
                room=room,
                sender=sender,
                content=content,
                message_type=message_type,
                attachment=attachment,
                attachment_name=attachment_name,
                reply_to_id=reply_to_id,
                is_ai_generated=is_ai_generated 
            )
            room.save(update_fields=['updated_at'])
            
            # 2. Broadcast Message Content (Standard Chat)
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.slug}",  
                {
                    'type': 'chat_message',
                    'message': message.to_websocket_dict()
                }
            )

            # 3. Broadcast Unread Counts (Safe Version)
            participants = room.participants.all()
            for member in participants:
                if sender and member.id == sender.id:
                    continue 
                
                try:
                    membership = ChatRoomMembership.objects.filter(room=room, user=member).first()
                    
                    counts = ChatRoomService.get_unread_counts_breakdown(member)
                    
                    room_unread = 0
                    if membership:
                        last_read_time = membership.last_read_at or membership.joined_at
                        room_unread = room.messages.filter(
                            is_deleted=False,
                            created_at__gt=last_read_time
                        ).exclude(sender=member).count()
                    
                    group_name = f"user_{member.id}_global"
                    
                    async_to_sync(channel_layer.group_send)(
                        group_name,
                        {
                            "type": "gateway_signal", 
                            "event": "CHAT_UNREAD_UPDATE",
                            "data": {
                                "room_id": str(room.id),
                                "room_type": room.room_type,
                                "total_unread": counts['total_unread'],
                                "thread_unread": counts['thread_unread'],
                                "room_unread": room_unread
                            }
                        }
                    )
                except Exception as inner_e:
                    print(f"Error sending signal to user {member.id}: {inner_e}")
                    continue

            # >>> NEW CODE: Trigger the persistent/offline notification <<<
            # This runs in the background for users who aren't on the WebSocket
            ChatMessageService._send_notification(message)
            if content and '@dyuksa' in content.lower() and message_type == 'text' and sender and not is_ai_generated:
                import threading
                threading.Thread(
                    target=ChatMessageService.process_zanflow_ai,
                    args=(room.id, content, sender.id)
                ).start()
            return message

        except Exception as e:
            print(f"CRITICAL ERROR in create_message: {e}")
            raise e
    # ------------------------------------------------------------------
    # CONTEXT BUILDER
    # Gathers all real data from the DB so the AI never has to guess.
    # ------------------------------------------------------------------
    @staticmethod
    def build_ai_context(room: ChatRoom, sender_user) -> dict:
        """
        Build a rich, structured context dictionary containing everything
        the AI needs to answer reliably:
          - Full user profile + ALL tasks (every status) with timing data
          - Full project data: all tasks grouped by status, all members
          - Team info
          - Calendar / events (if the model exists)
          - Recent chat history (last 30 messages, AI replies filtered out)

        Returns a plain dict that process_zanflow_ai serialises into the
        system prompt.
        """
        from apps.tasksite.models import Task

        context = {}

        # ── 1. USER PROFILE ───────────────────────────────────────────
        context['user'] = {
            'id': sender_user.id,
            'username': sender_user.username,
            'full_name': sender_user.get_full_name() or sender_user.username,
            'email': sender_user.email,
        }

        # ── 2. USER'S TASKS (ALL statuses) ───────────────────────────
        all_user_tasks = Task.objects.filter(
            assigned_to=sender_user
        ).select_related('project').prefetch_related('assigned_to')

        user_tasks_by_status = {
            'pending': [],
            'in_progress': [],
            'completed': [],
            'overdue': [],
            'other': [],
        }

        now = timezone.now()
        total_completion_seconds = []

        for task in all_user_tasks:
            # Compute how long the task took if completed
            completion_time_str = None
            if task.status == 'completed':
                # Use updated_at as proxy for completed_at if no dedicated field exists
                completed_at = getattr(task, 'completed_at', None) or task.updated_at
                delta = completed_at - task.created_at
                hours = delta.total_seconds() / 3600
                completion_time_str = f"{hours:.1f} hrs"
                total_completion_seconds.append(delta.total_seconds())

            # Detect overdue: pending/in_progress tasks past their due_date
            due_date = getattr(task, 'due_date', None)
            is_overdue = (
                due_date
                and task.status not in ['completed']
                and due_date < now
            )

            task_entry = {
                'id': task.id,
                'heading': task.heading,
                'status': task.status,
                'priority': task.priority,
                'project_name': task.project.name if task.project else 'No Project',
                'project_id': task.project.id if task.project else None,
                'created_at': task.created_at.strftime('%Y-%m-%d'),
                'due_date': due_date.strftime('%Y-%m-%d') if due_date else 'Not set',
                'completion_time': completion_time_str,
                'description': (task.description or '')[:120],
            }

            if is_overdue:
                user_tasks_by_status['overdue'].append(task_entry)
            elif task.status == 'pending':
                user_tasks_by_status['pending'].append(task_entry)
            elif task.status == 'in_progress':
                user_tasks_by_status['in_progress'].append(task_entry)
            elif task.status == 'completed':
                user_tasks_by_status['completed'].append(task_entry)
            else:
                user_tasks_by_status['other'].append(task_entry)

        # Average completion time
        if total_completion_seconds:
            avg_hours = (sum(total_completion_seconds) / len(total_completion_seconds)) / 3600
            context['user_avg_completion_hours'] = round(avg_hours, 1)
        else:
            context['user_avg_completion_hours'] = None

        context['user_tasks'] = user_tasks_by_status

        # ── 3. PROJECT CONTEXT ────────────────────────────────────────
        project = room.project
        if project:
            # All tasks in the project (not just the current user's)
            project_tasks = Task.objects.filter(
                project=project
            ).prefetch_related('assigned_to')

            project_task_groups = {
                'pending': [],
                'in_progress': [],
                'completed': [],
                'overdue': [],
                'other': [],
            }

            for task in project_tasks:
                due_date = getattr(task, 'due_date', None)
                is_overdue = (
                    due_date
                    and task.status not in ['completed']
                    and due_date < now
                )
                assignees = ", ".join([
                    u.get_full_name() or u.username
                    for u in task.assigned_to.all()
                ]) or 'Unassigned'

                t = {
                    'id': task.id,
                    'heading': task.heading,
                    'status': task.status,
                    'priority': task.priority,
                    'assignees': assignees,
                    'due_date': due_date.strftime('%Y-%m-%d') if due_date else 'Not set',
                    'created_at': task.created_at.strftime('%Y-%m-%d'),
                }

                if is_overdue:
                    project_task_groups['overdue'].append(t)
                elif task.status == 'pending':
                    project_task_groups['pending'].append(t)
                elif task.status == 'in_progress':
                    project_task_groups['in_progress'].append(t)
                elif task.status == 'completed':
                    project_task_groups['completed'].append(t)
                else:
                    project_task_groups['other'].append(t)

            # Project members with IDs (needed for task assignment)
            members_qs = []
            if hasattr(project, 'members'):
                members_qs = project.members.all().select_related()
            elif hasattr(project, 'memberships'):
                members_qs = [m.user for m in project.memberships.select_related('user')]

            project_members = [
                {
                    'id': u.id,
                    'username': u.username,
                    'full_name': u.get_full_name() or u.username,
                    'email': u.email,
                }
                for u in members_qs
            ]

            context['project'] = {
                'id': project.id,
                'name': project.name,
                'description': getattr(project, 'description', '') or '',
                'status': getattr(project, 'status', 'unknown'),
                'start_date': project.created_at.strftime('%Y-%m-%d') if hasattr(project, 'created_at') and project.created_at else 'Unknown',
                'deadline': getattr(project, 'deadline', None),
                'tasks': project_task_groups,
                'task_counts': {
                    'total': sum(len(v) for v in project_task_groups.values()),
                    'pending': len(project_task_groups['pending']),
                    'in_progress': len(project_task_groups['in_progress']),
                    'completed': len(project_task_groups['completed']),
                    'overdue': len(project_task_groups['overdue']),
                },
                'members': project_members,
            }
        else:
            context['project'] = None

        # ── 4. TEAM CONTEXT ──────────────────────────────────────────
        team = getattr(room, 'team', None)
        if team:
            team_members = []
            if hasattr(team, 'members'):
                for m in team.members.select_related('user'):
                    u = m.user
                    team_members.append({
                        'id': u.id,
                        'username': u.username,
                        'full_name': u.get_full_name() or u.username,
                        'role': getattr(m, 'role', 'member'),
                    })
            context['team'] = {
                'id': team.id,
                'name': team.name,
                'members': team_members,
            }
        else:
            context['team'] = None

        # ── 5. CALENDAR / EVENTS (optional — skipped if model missing) ─
        try:
            from apps.daily_updates.models import Event  # adjust import path if different
            upcoming_events = Event.objects.filter(
                Q(attendees=sender_user) | Q(created_by=sender_user),
                start_date__gte=now,
                start_date__lte=now + timezone.timedelta(days=14),
            ).order_by('start_date')[:10]

            context['upcoming_events'] = [
                {
                    'title': ev.title,
                    'start': ev.start_date.strftime('%Y-%m-%d %H:%M'),
                    'end': ev.end_date.strftime('%Y-%m-%d %H:%M') if getattr(ev, 'end_date', None) else '',
                    'description': (getattr(ev, 'description', '') or '')[:80],
                }
                for ev in upcoming_events
            ]
        except Exception:
            # Calendar app not present or model differs — not a blocker
            context['upcoming_events'] = []

        # ── 6. CHAT HISTORY (last 30, human messages only) ──────────
        history_qs = ChatMessage.objects.filter(
            room=room,
            is_deleted=False,
            is_ai_generated=False,   # skip bot replies to reduce noise
        ).order_by('-created_at')[:30]

        context['chat_history'] = [
            {
                'sender': msg.sender.username if msg.sender else 'System',
                'content': msg.content,
                'at': msg.created_at.strftime('%H:%M'),
            }
            for msg in reversed(list(history_qs))
        ]

        # ── 7. ROOM PARTICIPANTS (for @mention resolution) ───────────
        context['room_participants'] = [
            {
                'id': u.id,
                'username': u.username,
                'full_name': u.get_full_name() or u.username,
            }
            for u in room.participants.all()
        ]

        return context

    # ------------------------------------------------------------------
    # PROMPT BUILDER
    # Turns the context dict into a clean, sectioned system prompt.
    # ------------------------------------------------------------------
    @staticmethod
    def build_system_prompt(context: dict) -> str:
        """
        Serialises the context dict into structured, clearly-labelled
        sections so the model reads the right data for each intent.
        """
        user = context['user']
        user_tasks = context['user_tasks']
        project = context['project']
        team = context['team']
        avg_hrs = context['user_avg_completion_hours']
        events = context['upcoming_events']
        history = context['chat_history']
        participants = context['room_participants']

        lines = []

        # ── Identity & role ──────────────────────────────────────────
        project_name = project['name'] if project else 'No Project'
        lines.append(
            "You are @dyuksa, the AI assistant embedded inside the Dyuksa ERP platform. "
            "You have been given REAL, LIVE data from the database. "
            "NEVER guess or make up task names, counts, or user information. "
            "ONLY use the data provided in the sections below. "
            "If data for a question is not present, say so clearly.\n\n"
            "CRITICAL SCOPING RULES:\n"
            f"- This chat room belongs to the project: '{project_name}'.\n"
            f"- When the user asks about project tasks, counts, or members, ALWAYS use ONLY the "
            f"'=== PROJECT: {project_name} ===' section below. Do NOT mix in tasks from other projects.\n"
            "- The '=== USER'S TASKS ===' section shows the current user's personal tasks across "
            "ALL projects — only use it when the user asks specifically about their own tasks "
            "(e.g. 'my tasks', 'my pending tasks', 'how long did I take').\n"
            "- ALWAYS list ALL items — never truncate. Show every single task in the relevant section."
        )

        # ── Current user ─────────────────────────────────────────────
        lines.append(
            f"\n=== CURRENT USER ===\n"
            f"Name: {user['full_name']} | Username: {user['username']} | ID: {user['id']} | Email: {user['email']}"
        )

        # ── User's own tasks (personal / cross-project) ───────────────
        lines.append(
            "\n=== USER'S TASKS (personal — across ALL projects) ===\n"
            "Use this section ONLY when the user asks about their own personal tasks."
        )

        def fmt_task(t, show_completion=False):
            line = (
                f"  • [#{t['id']}] {t['heading']} | "
                f"Status: {t['status']} | Priority: {t['priority']} | "
                f"Project: {t['project_name']} | Due: {t['due_date']}"
            )
            if show_completion and t.get('completion_time'):
                line += f" | Took: {t['completion_time']}"
            return line

        if user_tasks['overdue']:
            lines.append(f"  OVERDUE ({len(user_tasks['overdue'])}):")
            lines.extend([fmt_task(t) for t in user_tasks['overdue']])
        if user_tasks['pending']:
            lines.append(f"  Pending ({len(user_tasks['pending'])}):")
            lines.extend([fmt_task(t) for t in user_tasks['pending']])
        if user_tasks['in_progress']:
            lines.append(f"  In Progress ({len(user_tasks['in_progress'])}):")
            lines.extend([fmt_task(t) for t in user_tasks['in_progress']])
        if user_tasks['completed']:
            lines.append(f"  Completed ({len(user_tasks['completed'])}) — ALL listed below:")
            lines.extend([fmt_task(t, show_completion=True) for t in user_tasks['completed']])
        if not any(user_tasks.values()):
            lines.append("  No tasks assigned to this user.")

        if avg_hrs is not None:
            lines.append(f"  Average task completion time: {avg_hrs} hours")

        # ── Project context ──────────────────────────────────────────
        if project:
            tc = project['task_counts']
            lines.append(
                f"\n=== PROJECT: {project['name']} ===\n"
                f"ID: {project['id']} | Status: {project['status']} | "
                f"Started: {project['start_date']}\n"
                f"Task Summary → Total: {tc['total']} | "
                f"Pending: {tc['pending']} | In Progress: {tc['in_progress']} | "
                f"Completed: {tc['completed']} | Overdue: {tc['overdue']}"
            )

            if project['description']:
                lines.append(f"Description: {project['description'][:200]}")

            # All project tasks (flat list — AI can answer "who is working on X?")
            lines.append("\n  ALL PROJECT TASKS:")
            all_proj_tasks = (
                project['tasks']['overdue']
                + project['tasks']['pending']
                + project['tasks']['in_progress']
                + project['tasks']['completed']
                + project['tasks']['other']
            )
            for t in all_proj_tasks:
                lines.append(
                    f"    • [#{t['id']}] {t['heading']} | "
                    f"Status: {t['status']} | Priority: {t['priority']} | "
                    f"Assigned to: {t['assignees']} | Due: {t['due_date']}"
                )

            # Project members (needed for task assignment)
            lines.append("\n  PROJECT MEMBERS (use IDs when creating tasks):")
            for m in project['members']:
                lines.append(
                    f"    - {m['full_name']} | Username: {m['username']} | ID: {m['id']}"
                )
        else:
            lines.append("\n=== PROJECT ===\nNo project context for this room.")

        # ── Team context ─────────────────────────────────────────────
        if team:
            lines.append(f"\n=== TEAM: {team['name']} ===")
            for m in team['members']:
                lines.append(
                    f"  - {m['full_name']} | Username: {m['username']} | "
                    f"ID: {m['id']} | Role: {m['role']}"
                )

        # ── Calendar / events ────────────────────────────────────────
        lines.append("\n=== UPCOMING EVENTS (next 14 days) ===")
        if events:
            for ev in events:
                lines.append(
                    f"  • {ev['title']} | Starts: {ev['start']} | Ends: {ev['end']}"
                )
        else:
            lines.append("  No upcoming events found.")

        # ── Room participants (for @mention resolution) ───────────────
        lines.append("\n=== ROOM PARTICIPANTS ===")
        for p in participants:
            lines.append(f"  - {p['full_name']} | Username: {p['username']} | ID: {p['id']}")

        # ── Chat history ─────────────────────────────────────────────
        lines.append("\n=== RECENT CHAT HISTORY ===")
        if history:
            for msg in history:
                lines.append(f"  [{msg['at']}] {msg['sender']}: {msg['content']}")
        else:
            lines.append("  No recent messages.")

        # ── Task creation instructions ───────────────────────────────
        lines.append(
            "\n=== TASK CREATION INSTRUCTIONS ===\n"
            "If the user explicitly asks you to CREATE A TASK, reply ONLY with a "
            "valid JSON block and NO other text whatsoever.\n"
            "Use project member IDs listed above when assigning tasks.\n"
            "If the user says 'assign it to me', use the CURRENT USER's ID shown above.\n"
            "Priority must be one of: low, medium, high, critical\n"
            "JSON format:\n"
            "```json\n"
            "{\n"
            '  "action": "create_task",\n'
            '  "heading": "Task title",\n'
            '  "description": "Task description",\n'
            '  "priority": "medium",\n'
            '  "assigned_to_ids": [12]\n'
            "}\n"
            "```\n"
            "For all other questions, reply in clear, friendly conversational text "
            "using ONLY the data provided above."
        )

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # MAIN AI PROCESSOR  (replaces the old process_zanflow_ai)
    # ------------------------------------------------------------------
    @staticmethod
    def process_zanflow_ai(room_id, prompt_text, user_id):
        from apps.tasksite.models import Task

        try:
            room = ChatRoom.objects.select_related('project', 'team').get(id=room_id)
            sender_user = User.objects.get(id=user_id)
        except (ChatRoom.DoesNotExist, User.DoesNotExist) as e:
            logger.error(f"process_zanflow_ai: object not found — {e}")
            return

        # ── Build rich context & system prompt ───────────────────────
        try:
            context = ChatMessageService.build_ai_context(room, sender_user)
            system_instruction = ChatMessageService.build_system_prompt(context)
        except Exception as ctx_err:
            logger.error(f"Failed to build AI context: {ctx_err}", exc_info=True)
            # Fall back to a minimal prompt so the bot still responds
            system_instruction = (
                f"You are @dyuksa, AI assistant in the Dyuksa platform. "
                f"User: {sender_user.username} (ID: {sender_user.id}). "
                "Context could not be loaded; apologise and ask the user to try again."
            )

        model_id = settings.BEDROCK_MODEL_ID
        logger.info(f"Invoking Bedrock AI (model: {model_id}) for room {room.id}")

        try:
            client = boto3.client(
                'bedrock-runtime',
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )

            # ── Payload formatting (support Nova + Claude 3) ──────────
            if "amazon.nova" in model_id.lower():
                body = json.dumps({
                    "system": [{"text": system_instruction}],
                    "messages": [{"role": "user", "content": [{"text": prompt_text}]}],
                    "inferenceConfig": {"maxTokens": 2048},
                })
            elif "claude" in model_id.lower():
                body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 2048,
                    "system": system_instruction,
                    "messages": [{"role": "user", "content": prompt_text}],
                })
            else:
                raise ValueError(f"Unsupported model family: {model_id}")

            response = client.invoke_model(
                modelId=model_id,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            response_body = json.loads(response.get('body').read())

            if "amazon.nova" in model_id.lower():
                ai_reply_text = (
                    response_body
                    .get('output', {})
                    .get('message', {})
                    .get('content', [{}])[0]
                    .get('text', "")
                )
            else:
                ai_reply_text = response_body.get('content', [{}])[0].get('text', "")

            ai_reply_text = ai_reply_text.strip()

        except Exception as e:
            logger.error(f"Bedrock invocation failed: {e}", exc_info=True)
            ChatMessageService.create_message(
                room=room,
                sender=None,
                content="I'm sorry, I couldn't reach my AI engine. Please try again in a moment.",
                is_ai_generated=True,
            )
            return

        # ── Intercept JSON → create task ─────────────────────────────
        try:
            cleaned_text = ai_reply_text
            if "```json" in cleaned_text:
                cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned_text:
                cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()

            ai_json = json.loads(cleaned_text)

            if isinstance(ai_json, dict) and ai_json.get("action") == "create_task":
                priority = str(ai_json.get("priority", "medium")).lower()
                if priority not in ['low', 'medium', 'high', 'critical']:
                    priority = 'medium'

                new_task = Task.objects.create(
                    heading=ai_json.get("heading", "AI Generated Task"),
                    description=ai_json.get("description", ""),
                    priority=priority,
                    project=room.project,
                    assigned_by=sender_user,
                    status="pending",
                )

                assignee_ids = ai_json.get("assigned_to_ids", []) or [user_id]
                new_task.assigned_to.add(*assignee_ids)

                # Broadcast task creation via WebSocket
                try:
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync
                    channel_layer = get_channel_layer()
                    members_to_notify = (
                        room.project.members.all()
                        if room.project
                        else User.objects.filter(id__in=assignee_ids)
                    )
                    for member in members_to_notify:
                        async_to_sync(channel_layer.group_send)(
                            f"user_{member.id}_global",
                            {
                                "type": "gateway_signal",
                                "event": "TASK_CREATED",
                                "data": {
                                    "task_id": new_task.id,
                                    "project_id": str(room.project.id) if room.project else None,
                                },
                            },
                        )
                except Exception as ws_err:
                    logger.error(f"Failed to broadcast task creation: {ws_err}")

                assignee_names = ", ".join(
                    u.get_full_name() or u.username
                    for u in new_task.assigned_to.all()
                )
                ai_reply_text = (
                    "\u2705 **Task Created Successfully!**\n\n"
                    + "**ID:** #" + str(new_task.id) + "\n"
                    + "**Heading:** " + new_task.heading + "\n"
                    + "**Priority:** " + new_task.priority.capitalize() + "\n"
                    + "**Assigned To:** " + assignee_names
                )

        except json.JSONDecodeError:
            # Normal conversational reply — no action needed
            pass
        except Exception as e:
            logger.error(f"Task creation via AI failed: {e}", exc_info=True)
            ai_reply_text = (
                "I understood your request to create a task, "
                "but a system error occurred while saving it. Please try again."
            )

        # ── Send the final AI reply back into the chat ────────────────
        ChatMessageService.create_message(
            room=room,
            sender=None,
            content=ai_reply_text,
            is_ai_generated=True,
        )

    @staticmethod
    def _send_notification(message: ChatMessage):
        """
        Send notification for new message.
        """
        try:
            from apps.notification.services import notify_new_chat_message
            
            room = message.room
            sender = message.sender
            
            if not sender:
                return
            
            if room.room_type == ChatRoom.RoomType.PRIVATE:
                recipients = list(room.participants.exclude(id=sender.id))
            elif room.room_type in [ChatRoom.RoomType.PROJECT, ChatRoom.RoomType.TEAM, ChatRoom.RoomType.THREAD]:
                memberships = ChatRoomMembership.objects.filter(
                    room=room,
                    is_muted=False
                ).exclude(user=sender)
                recipients = list(User.objects.filter(
                    id__in=memberships.values_list('user_id', flat=True)
                ))
            else:
                return
            
            if recipients:
                notify_new_chat_message(
                    room=room,
                    message=message,
                    actor=sender,
                    recipients=recipients
                )
                
        except ImportError as e:
            logger.warning(f"Notification app not available or import failed: {e}")
        except Exception as e:
            logger.error(f"Failed to send chat notification: {str(e)}")

    @staticmethod
    def get_room_messages(
        room: ChatRoom,
        user,
        limit: int = 50,
        before: Optional[str] = None,
        after: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get messages for a room with pagination.
        
        Args:
            room: ChatRoom instance
            user: Requesting user (for read status)
            limit: Maximum messages to return
            before: Get messages before this message ID
            after: Get messages after this message ID
            
        Returns:
            List of message dictionaries
        """
        query = room.messages.filter(is_deleted=False)
        
        if before:
            try:
                before_msg = ChatMessage.objects.get(id=before)
                query = query.filter(created_at__lt=before_msg.created_at)
            except ChatMessage.DoesNotExist:
                pass
        
        if after:
            try:
                after_msg = ChatMessage.objects.get(id=after)
                query = query.filter(created_at__gt=after_msg.created_at)
            except ChatMessage.DoesNotExist:
                pass
        
        # Order by most recent first for pagination, then reverse
        messages = query.order_by('-created_at')[:limit]
        messages = list(reversed(messages))
        
        return [msg.to_websocket_dict() for msg in messages]

    @staticmethod
    def mark_messages_as_read(room, user) -> int:
        """
        Mark all messages in a room as read and BROADCAST the new count.
        """
        # 1. Update DB (Your existing code)
        membership = ChatRoomMembership.objects.filter(room=room, user=user).first()
        if membership:
            membership.mark_as_read()
        
        # (Optional) Create detailed read receipts if you use them
        unread_messages = room.messages.filter(
            created_at__gt=membership.last_read_at if membership else timezone.now()
        ).exclude(sender=user)
        
        read_statuses = []
        for msg in unread_messages:
            if not MessageReadStatus.objects.filter(message=msg, user=user).exists():
                read_statuses.append(MessageReadStatus(message=msg, user=user))
        if read_statuses:
            MessageReadStatus.objects.bulk_create(read_statuses, ignore_conflicts=True)

        # 2. >>> NEW CODE: Broadcast New Unread Count <<<
        try:
            channel_layer = get_channel_layer()
            
            # Use your breakdown helper instead of get_total_unread_count
            counts = ChatRoomService.get_unread_counts_breakdown(user)
            
            # Send the signal to the User's Personal Group
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}_global",
                {
                    "type": "gateway_signal",
                    "event": "CHAT_UNREAD_UPDATE",
                    "data": {
                        "room_id": str(room.id),
                        "room_type": room.room_type,
                        "total_unread": counts['total_unread'],   # Normal chats only
                        "thread_unread": counts['thread_unread'], # Threads only
                        "room_unread": 0  # It is definitely 0 now!
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to broadcast read status: {e}")

        return len(read_statuses)

    @staticmethod
    def delete_message(message: ChatMessage, user) -> bool:
        """
        Soft delete a message and broadcast the event.
        """
        # Check permissions
        if message.sender_id != user.id:
            # Check if user is admin
            if not (hasattr(user, 'role') and user.role == 'admin'):
                return False
        
        # Perform the soft delete (defined in your models.py)
        message.soft_delete()
        logger.info(f"Message {message.id} deleted by user {user.id}")

        # --- NEW CODE: Broadcast deletion to WebSocket ---
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{message.room.slug}", 
            {
                'type': 'chat_message_delete', # This maps to a handler in consumers.py
                'event_data': {
                    'id': str(message.id),
                    'room_id': str(message.room.id),
                    'is_deleted': True,
                    'content': '[Message deleted]' 
                }
            }
        )
        return True

    @staticmethod
    def search_messages(
        user,
        query: str,
        room_id: Optional[UUID] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search messages across user's rooms.
        
        Args:
            user: User performing search
            query: Search query string
            room_id: Optional room to limit search
            limit: Maximum results
            
        Returns:
            List of matching messages
        """
        # Get rooms user has access to
        accessible_rooms = ChatRoom.objects.filter(
            Q(room_type=ChatRoom.RoomType.GLOBAL) |
            Q(participants=user)
        ).values_list('id', flat=True)
        
        messages_query = ChatMessage.objects.filter(
            room_id__in=accessible_rooms,
            is_deleted=False,
            content__icontains=query
        )
        
        if room_id:
            messages_query = messages_query.filter(room_id=room_id)
        
        messages = messages_query.order_by('-created_at')[:limit]
        
        return [msg.to_websocket_dict() for msg in messages]


class ChatPermissionService:
    """
    Service for handling chat permissions based on user roles.
    """
    
    @staticmethod
    def can_send_message(user, room: ChatRoom) -> bool:
        """Check if user can send messages in room."""
        if not user or not user.is_authenticated:
            return False
        
        return ChatRoomService.check_room_access(room, user)

    @staticmethod
    def can_delete_message(user, message: ChatMessage) -> bool:
        """Check if user can delete a message."""
        if not user or not user.is_authenticated:
            return False
        
        # Sender can delete their own messages
        if message.sender_id == user.id:
            return True
        
        # Admin can delete any message
        if hasattr(user, 'role') and user.role == 'admin':
            return True
        
        # Room moderator/admin can delete
        membership = ChatRoomMembership.objects.filter(
            room=message.room,
            user=user,
            room_role__in=['moderator', 'admin']
        ).exists()
        
        return membership

    @staticmethod
    def can_manage_room(user, room: ChatRoom) -> bool:
        """Check if user can manage room settings."""
        if not user or not user.is_authenticated:
            return False
        
        # Admin can manage all rooms
        if hasattr(user, 'role') and user.role == 'admin':
            return True
        
        # Room creator can manage
        if room.created_by_id == user.id:
            return True
        
        # Room admin can manage
        return ChatRoomMembership.objects.filter(
            room=room,
            user=user,
            room_role='admin'
        ).exists()
    
    @staticmethod
    def can_delete_thread(user, room: ChatRoom) -> bool:
        """
        STRICT CHECK: Only the exact user who created the thread can delete it.
        No admins allowed.
        """
        if not user or not user.is_authenticated:
            return False
            
        if room.room_type != ChatRoom.RoomType.THREAD:
            return False
            
        # VERY STRICT: Compare the IDs directly. Remove any admin checks.
        return room.created_by_id == user.id