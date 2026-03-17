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

            return message

        except Exception as e:
            print(f"CRITICAL ERROR in create_message: {e}")
            raise e
    @staticmethod
    def process_zanflow_ai(room_id, prompt_text, user_id):
        from apps.tasksite.models import Task 
        
        room = ChatRoom.objects.get(id=room_id)
        sender_user = User.objects.get(id=user_id)
        
        # 1. Fetch active tasks for the user
        active_tasks = Task.objects.filter(
            assigned_to=sender_user, 
            status__in=['pending', 'in_progress']
        )
        
        if active_tasks.exists():
            task_list_str = "\n".join([
                f"- Task ID: {task.id}, Heading: {task.heading}, Status: {task.status}, Priority: {task.priority}" 
                for task in active_tasks
            ])
        else:
            task_list_str = "The user currently has NO assigned tasks."

        # 2. Fetch Chat History
        history = ChatMessage.objects.filter(room=room, is_deleted=False).order_by('-created_at')[:15]
        context_str = "\n".join([
            f"{msg.sender.username if msg.sender else '@zanflow'}: {msg.content}" 
            for msg in reversed(history)
        ])
        
        # Project/Thread Context
        participants = room.participants.all()
        users_context = "\n".join([f"- Name: {u.get_full_name() or u.username} | Username: {u.username} | ID: {u.id}" for u in participants])
        project_context = f"Project context: {room.project.name if room.project else 'None'}"

        # 4. Update the System Instruction
        system_instruction = (
            "You are @zanflow, an AI assistant inside the Zanflow platform. "
            f"The user speaking to you right now has the ID: {user_id}. "
            f"{project_context}\n"
            "Always base your task summaries ONLY on the 'Current Real Tasks' provided below.\n\n"
            f"--- CURRENT REAL TASKS ---\n{task_list_str}\n--------------------------\n\n"
            f"--- AVAILABLE USERS IN CONTEXT ---\n{users_context}\n---------------------------------------\n\n"
            "=== TASK CREATION INSTRUCTIONS ===\n"
            "If the user explicitly asks you to CREATE A TASK, you must reply ONLY with a valid JSON block and NO OTHER TEXT. "
            "If they say 'assign it to me', use the ID of the user speaking to you. "
            "Match the user names mentioned to the User IDs provided. "
            "The JSON MUST look exactly like this:\n"
            "```json\n"
            "{\n"
            '  "action": "create_task",\n'
            '  "heading": "Task title",\n'
            '  "description": "Task description",\n'
            '  "priority": "medium",\n'  # priority must be one of: low, medium, high, critical
            '  "assigned_to_ids": [12]\n'
            "}\n"
            "```\n"
            "If they are NOT asking to create a task, reply with normal conversational text to fulfill their request based on the Chat History:\n"
            f"Chat History:\n{context_str}"
        )

        model_id = settings.BEDROCK_MODEL_ID
        logger.info(f"Invoking Bedrock AI using model: {model_id} for room {room.id}")

        try:
            client = boto3.client(
                'bedrock-runtime', 
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            
            # Payload formatting
            if "amazon.nova" in model_id.lower():
                body = json.dumps({
                    "system": [{"text": system_instruction}],
                    "messages": [{"role": "user", "content": [{"text": prompt_text}]}],
                    "inferenceConfig": {"maxTokens": 1024}
                })
            elif "claude-3" in model_id.lower():
                body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 1024,
                    "system": system_instruction,
                    "messages": [{"role": "user", "content": prompt_text}]
                })
            else:
                raise ValueError(f"Unsupported model family for ID: {model_id}")
            
            # Invoke model
            response = client.invoke_model(
                modelId=model_id,
                body=body,
                contentType="application/json",
                accept="application/json"
            )
            response_body = json.loads(response.get('body').read())
            
            if "amazon.nova" in model_id.lower():
                ai_reply_text = response_body.get('output', {}).get('message', {}).get('content', [{}])[0].get('text', "")
            elif "claude-3" in model_id.lower():
                ai_reply_text = response_body.get('content')[0].get('text')
            else:
                ai_reply_text = "I processed your request, but couldn't parse my own output."
            
            # ==========================================================
            # 5. INTERCEPT AI JSON AND CREATE THE TASK
            # ==========================================================
            ai_reply_text = ai_reply_text.strip()
            
            try:
                # Check if the AI replied with the JSON block
                cleaned_text = ai_reply_text
                if "```json" in cleaned_text:
                    cleaned_text = cleaned_text.split("```json")[1].split("```")[0].strip()
                elif "```" in cleaned_text:
                    cleaned_text = cleaned_text.split("```")[1].split("```")[0].strip()
                    
                ai_json = json.loads(cleaned_text)
                
                # Check if the AI wants to execute the 'create_task' action
                if isinstance(ai_json, dict) and ai_json.get("action") == "create_task":
                    
                    # Ensure priority matches Django model choices
                    priority = str(ai_json.get("priority", "medium")).lower()
                    if priority not in ['low', 'medium', 'high', 'critical']:
                        priority = 'medium'
                        
                    # ---> NEW: Handle missing project context gracefully <---
                    project_to_assign = room.project
                        
                    # Create the Task in the database
                    new_task = Task.objects.create(
                        heading=ai_json.get("heading", "AI Generated Task"),
                        description=ai_json.get("description", ""),
                        priority=priority,
                        project=project_to_assign, # Will be None if generated from Global bot
                        assigned_by=sender_user,
                        status="pending"
                    )
                    
                    # Assign the users
                    assignee_ids = ai_json.get("assigned_to_ids", [])
                    if not assignee_ids:
                        assignee_ids = [user_id] # Default to the person who asked if AI fails
                    new_task.assigned_to.add(*assignee_ids)
                    
                    # Format a nice success message to show in the chat
                    assignees = new_task.assigned_to.all()
                    assignee_names = ", ".join([u.username for u in assignees])
                    
                    ai_reply_text = (
                        f"✅ **Task Created Successfully!**\n\n"
                        f"**ID:** #{new_task.id}\n"
                        f"**Heading:** {new_task.heading}\n"
                        f"**Priority:** {new_task.priority.capitalize()}\n"
                        f"**Assigned To:** {assignee_names}"
                    )
            except json.JSONDecodeError:
                # The AI didn't output JSON, it output a normal text reply. 
                pass
            except Exception as e:
                logger.error(f"Failed to create task via AI: {e}")
                ai_reply_text = "I understood your request to create a task, but a system error occurred while saving it to the database."

            # 6. Push the final message back to the chat room
            ChatMessageService.create_message(
                room=room,
                sender=None,
                content=ai_reply_text,
                is_ai_generated=True
            )
            
        except Exception as e:
            logger.error(f"Failed to invoke Bedrock AI: {e}")
            ChatMessageService.create_message(
                room=room,
                sender=None,
                content="I'm sorry, my AI processing failed. Please check the server logs.",
                is_ai_generated=True
            )
    @staticmethod
    def _send_notification(message: ChatMessage):
        """
        Send notification for new message.
        Integrates with existing notification app.
        
        Args:
            message: ChatMessage instance
        """
        try:
            # Import notification service - adjust import based on your notification app structure
            from apps.notification.services import NotificationService
            
            room = message.room
            sender = message.sender
            
            # Get recipients (all participants except sender)
            if room.room_type == ChatRoom.RoomType.PRIVATE:
                recipients = room.participants.exclude(id=sender.id)
            elif room.room_type == ChatRoom.RoomType.PROJECT:
                # Only notify unmuted members
                memberships = ChatRoomMembership.objects.filter(
                    room=room,
                    is_muted=False
                ).exclude(user=sender)
                recipients = User.objects.filter(
                    id__in=memberships.values_list('user_id', flat=True)
                )
            else:
                # Global chat - might want to limit notifications
                return  # Skip notifications for global chat
            
            # Create notifications
            for recipient in recipients:
                NotificationService.create_notification(
                    recipient=recipient,
                    title=f"New message from {sender.username}",
                    message=message.content[:100],
                    notification_type='chat_message',
                    related_object_id=str(message.id),
                    related_object_type='chat_message'
                )
                
        except ImportError:
            logger.warning("Notification app not available, skipping message notification")
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
