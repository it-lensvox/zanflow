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
    def create_message(room, sender, content, message_type='text', attachment=None, attachment_name='', reply_to_id=None):
        # 1. Save the message to the Database
        message = ChatMessage.objects.create(
            room=room,
            sender=sender,
            content=content,
            message_type=message_type,
            attachment=attachment,
            attachment_name=attachment_name,
            reply_to_id=reply_to_id
        )

        # 2. BROADCAST TO WEBSOCKET (This is the missing part!)
        channel_layer = get_channel_layer()
        
        # We broadcast to "chat_{slug}" because that is what the Gateway subscribes to
        async_to_sync(channel_layer.group_send)(
            f"chat_{room.slug}",  
            {
                'type': 'chat_message',    # Calls GatewayConsumer.chat_message()
                'message': message.to_websocket_dict()
            }
        )
        
        return message

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
    def mark_messages_as_read(room: ChatRoom, user) -> int:
        """
        Mark all messages in a room as read by user.
        
        Args:
            room: ChatRoom instance
            user: User marking messages as read
            
        Returns:
            Number of messages marked as read
        """
        # Update membership last_read_at
        membership = ChatRoomMembership.objects.filter(
            room=room,
            user=user
        ).first()
        
        if membership:
            membership.mark_as_read()
        
        # For detailed read receipts (optional)
        unread_messages = room.messages.filter(
            created_at__gt=membership.last_read_at if membership else timezone.now()
        ).exclude(sender=user)
        
        # Create read statuses
        read_statuses = []
        for msg in unread_messages:
            if not MessageReadStatus.objects.filter(message=msg, user=user).exists():
                read_statuses.append(MessageReadStatus(message=msg, user=user))
        
        if read_statuses:
            MessageReadStatus.objects.bulk_create(read_statuses, ignore_conflicts=True)
        
        return len(read_statuses)

    @staticmethod
    def delete_message(message: ChatMessage, user) -> bool:
        """
        Soft delete a message.
        Only sender or room admin can delete.
        
        Args:
            message: ChatMessage to delete
            user: User requesting deletion
            
        Returns:
            Boolean indicating success
        """
        # Check permissions
        if message.sender_id != user.id:
            # Check if user is admin
            if not (hasattr(user, 'role') and user.role == 'admin'):
                return False
        
        message.soft_delete()
        logger.info(f"Message {message.id} deleted by user {user.id}")
        
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
