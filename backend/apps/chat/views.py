"""
REST API views for chat functionality.

All views are class-based APIViews for explicit URL mapping.
"""
import logging

from django.db.models import Q
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.parsers import MultiPartParser, FormParser
from .models import ChatRoom, ChatMessage, ChatRoomMembership
from .serializers import (
    ChatRoomListSerializer,
    ChatRoomDetailSerializer,
    ChatMessageSerializer,
    CreatePrivateRoomSerializer,
    CreateProjectRoomSerializer,
    AddParticipantSerializer,
    RoomSettingsSerializer,
    MessageSearchSerializer,
    ChatMessageCreateSerializer,
    CreateThreadRoomSerializer
)
from .services import ChatRoomService, ChatMessageService, ChatPermissionService

logger = logging.getLogger(__name__)
User = get_user_model()


# =============================================================================
# ROOM VIEWS
# =============================================================================
class UserListView(APIView):
    """
    List all users for chat sidebar.
    Returns all active users except the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.filter(
            is_active=True
        ).exclude(
            id=request.user.id
        ).values(
            'id', 
            'username', 
            'email', 
            'first_name', 
            'last_name'
        )
        
        return Response(list(users))
class CreateThreadRoomView(APIView):
    """
    Create or get a thread room for a specific message.
    
    POST /api/v1/chat/rooms/thread/
    Body: { "parent_message_id": <uuid> }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create thread chat room",
        # We will need to update serializers.py for CreateThreadRoomSerializer
        # request=CreateThreadRoomSerializer, 
        responses={201: ChatRoomDetailSerializer}
    )
    def post(self, request):
        """Create a new thread branching from a specific message."""
        parent_msg_id = request.data.get('parent_message_id')
        if not parent_msg_id:
            return Response(
                {'error': 'parent_message_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        parent_message = get_object_or_404(ChatMessage, id=parent_msg_id)
        
        # We will add create_thread_room to ChatRoomService in the next step
        room = ChatRoomService.create_thread_room(parent_message, request.user)
        
        serializer = ChatRoomDetailSerializer(
            room,
            context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
class ChatRoomListView(APIView):
    """
    List all chat rooms for the current user.
    
    GET /api/v1/chat/rooms/
    Query params:
        - type: Filter by room type (global, project, private)
        - project_id: Filter by project ID
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List user's chat rooms",
        parameters=[
            OpenApiParameter(name='type', description='Filter by room type (global, project, private)', required=False),
            OpenApiParameter(name='project_id', description='Filter by project UUID', required=False),
        ],
        responses={200: ChatRoomListSerializer(many=True)}
    )
    def get(self, request):
        """Get all rooms accessible by current user."""
        user = request.user
        
        # Base query - rooms user has access to
        queryset = ChatRoom.objects.filter(is_active=True)
        
        # Filter rooms user can access
        queryset = queryset.filter(
            Q(room_type=ChatRoom.RoomType.GLOBAL) |
            Q(participants=user)
        ).distinct()
        
        # Optional filter by room type
        room_type = request.query_params.get('type')
        if room_type:
            queryset = queryset.filter(room_type=room_type)
        
        # Optional filter by project
        project_id = request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        queryset = queryset.order_by('-updated_at')
        
        serializer = ChatRoomListSerializer(
            queryset,
            many=True,
            context={'request': request}
        )
        
        return Response(serializer.data)
class SendMessageView(APIView):
    """
    Send a message with optional file attachment.
    
    POST /api/v1/chat/rooms/<room_id>/send/
    Headers: Content-Type: multipart/form-data
    Form Fields:
        - content: Text message (optional if file exists)
        - attachment: File object (optional)
        - reply_to: UUID (optional)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]  # Required for handling files

    @extend_schema(
        summary="Send message (Text or File)",
        request=ChatMessageCreateSerializer,
        responses={201: ChatMessageSerializer}
    )
    def post(self, request, room_id):
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # Check permissions
        if not ChatPermissionService.can_send_message(request.user, room):
            return Response(
                {'error': 'You do not have permission to send messages in this room'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Validate basic data
        serializer = ChatMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Extract file data
        attachment = request.FILES.get('attachment')
        
        # Determine message type
        message_type = 'text'
        attachment_name = ''
        
        if attachment:
            message_type = 'file'
            attachment_name = attachment.name
            # Basic validation check for images vs generic files
            if attachment.content_type.startswith('image/'):
                message_type = 'image'

        # Ensure we have either text or a file
        content = serializer.validated_data.get('content', '').strip()
        if not content and not attachment:
             return Response(
                {'error': 'Message must contain either text or a file'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            message = ChatMessageService.create_message(
                room=room,
                sender=request.user,
                content=content,
                message_type=message_type,
                attachment=attachment,
                attachment_name=attachment_name,
                reply_to_id=serializer.validated_data.get('reply_to')
            )
            
            # # # ---> NEW: Auto-trigger AI if this is the global AI Bot room <---
            # if room.room_type == ChatRoom.RoomType.AI_BOT and message_type == 'text':
            #     # Run asynchronously using threading (or Celery if you have it set up)
            #     import threading
            #     threading.Thread(
            #         target=ChatMessageService.process_zanflow_ai,
            #         args=(room.id, content, request.user.id)
            #     ).start()
            
            # # ---> Optional: Keep your existing @zanflow trigger for other rooms <---
            if '@dyuksa' in content.lower() and message_type == 'text':
                import threading
                threading.Thread(
                    target=ChatMessageService.process_zanflow_ai,
                    args=(room.id, content, request.user.id)
                ).start()

            response_serializer = ChatMessageSerializer(message, context={'request': request})
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Failed to send message: {str(e)}")
            return Response(
                {'error': 'Failed to send message'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ChatRoomDetailView(APIView):
    """
    Get details of a specific chat room.
    
    GET /api/v1/chat/rooms/<room_id>/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get room details",
        responses={200: ChatRoomDetailSerializer}
    )
    def get(self, request, room_id):
        """Get detailed room information."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # Check access permission
        if not ChatRoomService.check_room_access(room, request.user):
            return Response(
                {'error': 'Access denied to this room'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ChatRoomDetailSerializer(room, context={'request': request})
        return Response(serializer.data)
    @extend_schema(summary="Delete a chat room/thread")
    def delete(self, request, room_id):
        """Soft delete a chat room/thread."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # 1. ENFORCE THE STRICT PERMISSION RULE
        if not ChatPermissionService.can_delete_thread(request.user, room):
            return Response(
                {'error': 'Access Denied: Only the creator of this thread can delete it.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. If they pass the check, perform the deletion
        # (Assuming you added delete_room to ChatRoomService as discussed previously)
        success = ChatRoomService.delete_room(room, request.user)

        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        return Response(
            {'error': 'An error occurred while trying to delete the thread.'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

class GetGlobalRoomView(APIView):
    """
    Get or create the global chat room.
    
    GET /api/v1/chat/rooms/global/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get or create global chat room",
        responses={200: ChatRoomDetailSerializer}
    )
    def get(self, request):
        """Get the global chat room, creating it if it doesn't exist."""
        room = ChatRoomService.create_global_room(
            name="Global Chat",
            created_by=request.user
        )
        
        serializer = ChatRoomDetailSerializer(room, context={'request': request})
        return Response(serializer.data)


class CreatePrivateRoomView(APIView):
    """
    Create or get a private chat room with another user.
    
    POST /api/v1/chat/rooms/private/
    Body: { "user_id": <int> }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create private chat room",
        request=CreatePrivateRoomSerializer,
        responses={
            200: ChatRoomDetailSerializer,
            201: ChatRoomDetailSerializer
        }
    )
    def post(self, request):
        """Create or get private chat room with another user."""
        serializer = CreatePrivateRoomSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        other_user = User.objects.get(id=serializer.validated_data['user_id'])
        
        room, created = ChatRoomService.get_or_create_private_room(
            request.user,
            other_user
        )
        
        response_serializer = ChatRoomDetailSerializer(
            room,
            context={'request': request}
        )
        
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class CreateProjectRoomView(APIView):
    """
    Create or get a chat room for a project.
    
    POST /api/v1/chat/rooms/project/
    Body: { "project_id": <uuid> }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create project chat room",
        request=CreateProjectRoomSerializer,
        responses={201: ChatRoomDetailSerializer}
    )
    def post(self, request):
        """Create or get chat room for a project."""
        serializer = CreateProjectRoomSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        from apps.projects.models import Project
        project = Project.objects.get(id=serializer.validated_data['project_id'])
        
        room = ChatRoomService.create_project_room(project, request.user)
        
        response_serializer = ChatRoomDetailSerializer(
            room,
            context={'request': request}
        )
        
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class JoinRoomView(APIView):
    """
    Join a chat room.
    
    POST /api/v1/chat/rooms/<room_id>/join/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Join a chat room")
    def post(self, request, room_id):
        """Join a chat room (for project rooms with open access)."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        if room.room_type == ChatRoom.RoomType.PRIVATE:
            return Response(
                {'error': 'Cannot join private rooms directly'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        membership = ChatRoomService.add_participant(room, request.user)
        
        return Response({
            'message': 'Successfully joined the room',
            'room_id': str(room.id),
            'room_name': room.name,
        })


class LeaveRoomView(APIView):
    """
    Leave a chat room.
    
    POST /api/v1/chat/rooms/<room_id>/leave/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Leave a chat room")
    def post(self, request, room_id):
        """Leave a chat room."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        if room.room_type == ChatRoom.RoomType.GLOBAL:
            return Response(
                {'error': 'Cannot leave global chat'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = ChatRoomService.remove_participant(room, request.user)
        
        if success:
            return Response({
                'message': 'Successfully left the room',
                'room_id': str(room.id),
            })
        
        return Response(
            {'error': 'You are not a member of this room'},
            status=status.HTTP_400_BAD_REQUEST
        )


class AddParticipantView(APIView):
    """
    Add a participant to a chat room.
    
    POST /api/v1/chat/rooms/<room_id>/add-participant/
    Body: { "user_id": <int>, "room_role": "member" }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Add participant to room",
        request=AddParticipantSerializer
    )
    def post(self, request, room_id):
        """Add a participant to a room. Requires room management permission."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # Check permission to manage room
        if not ChatPermissionService.can_manage_room(request.user, room):
            return Response(
                {'error': 'You do not have permission to manage this room'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = AddParticipantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = User.objects.get(id=serializer.validated_data['user_id'])
        room_role = serializer.validated_data.get('room_role', 'member')
        
        membership = ChatRoomService.add_participant(room, user, room_role)
        
        return Response({
            'message': f'User {user.username} added to room',
            'room_id': str(room.id),
            'user_id': user.id,
            'room_role': room_role,
        })


class RoomSettingsView(APIView):
    """
    Update room settings for current user (mute/unmute, favorite/unfavorite).
    
    PATCH /api/v1/chat/rooms/<room_id>/settings/
    Body: { "is_muted": boolean, "is_favourite": boolean }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Update room settings",
        request=RoomSettingsSerializer
    )
    def patch(self, request, room_id):
        """Update user's room settings."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        membership = ChatRoomMembership.objects.filter(
            room=room,
            user=request.user
        ).first()
        
        if not membership:
            return Response(
                {'error': 'You are not a member of this room'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = RoomSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        updated_fields = []

        if 'is_muted' in serializer.validated_data:
            membership.is_muted = serializer.validated_data['is_muted']
            updated_fields.append('is_muted')

        # --- ADD THIS BLOCK ---
        if 'is_favourite' in serializer.validated_data:
            membership.is_favourite = serializer.validated_data['is_favourite']
            updated_fields.append('is_favourite')
        
        if updated_fields:
            membership.save(update_fields=updated_fields)
        
        return Response({
            'message': 'Settings updated successfully',
            'room_id': str(room.id),
            'is_muted': membership.is_muted,
            'is_favourite': membership.is_favourite, # <--- Return new status
        })


# =============================================================================
# MESSAGE VIEWS
# =============================================================================

class RoomMessagesListView(APIView):
    """
    List messages in a chat room with pagination.
    
    GET /api/v1/chat/rooms/<room_id>/messages/
    Query params:
        - before: Get messages before this message ID
        - after: Get messages after this message ID
        - limit: Number of messages to return (default 50, max 100)
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List room messages",
        parameters=[
            OpenApiParameter(name='before', description='Get messages before this message UUID', required=False),
            OpenApiParameter(name='after', description='Get messages after this message UUID', required=False),
            OpenApiParameter(name='limit', description='Max messages to return (default 50)', required=False),
        ],
        responses={200: ChatMessageSerializer(many=True)}
    )
    def get(self, request, room_id):
        """Get paginated messages for a room."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # Check access permission
        if not ChatRoomService.check_room_access(room, request.user):
            return Response(
                {'error': 'Access denied to this room'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Build query
        queryset = ChatMessage.objects.filter(
            room=room,
            is_deleted=False
        ).select_related('sender', 'reply_to').order_by('-created_at')
        
        # Cursor-based pagination
        before = request.query_params.get('before')
        after = request.query_params.get('after')
        limit = int(request.query_params.get('limit', 50))
        limit = min(limit, 100)  # Max 100 messages
        
        if before:
            try:
                before_msg = ChatMessage.objects.get(id=before)
                queryset = queryset.filter(created_at__lt=before_msg.created_at)
            except ChatMessage.DoesNotExist:
                pass
        
        if after:
            try:
                after_msg = ChatMessage.objects.get(id=after)
                queryset = queryset.filter(created_at__gt=after_msg.created_at)
                queryset = queryset.order_by('created_at')  # Reverse order for after
            except ChatMessage.DoesNotExist:
                pass
        
        messages = list(queryset[:limit])
        
        # Reverse if paginating with 'after'
        if after:
            messages = list(reversed(messages))
        
        serializer = ChatMessageSerializer(
            messages,
            many=True,
            context={'request': request}
        )
        
        # Mark messages as read
        ChatMessageService.mark_messages_as_read(room, request.user)
        
        return Response({
            'messages': serializer.data,
            'count': len(messages),
            'has_more': len(messages) == limit,
        })


class RoomMessageDetailView(APIView):
    """
    Get details of a specific message.
    
    GET /api/v1/chat/rooms/<room_id>/messages/<message_id>/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get message details",
        responses={200: ChatMessageSerializer}
    )
    def get(self, request, room_id, message_id):
        """Get a single message's details."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # Check access permission
        if not ChatRoomService.check_room_access(room, request.user):
            return Response(
                {'error': 'Access denied to this room'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        message = get_object_or_404(
            ChatMessage,
            id=message_id,
            room=room,
            is_deleted=False
        )
        
        serializer = ChatMessageSerializer(message, context={'request': request})
        return Response(serializer.data)
    # --- ADD THIS NEW METHOD BELOW ---
    @extend_schema(summary="Delete a message")
    def delete(self, request, room_id, message_id):
        """Soft delete a message."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        message = get_object_or_404(
            ChatMessage, 
            id=message_id, 
            room=room
        )

        # Check permissions using your service
        if not ChatPermissionService.can_delete_message(request.user, message):
            return Response(
                {'error': 'You do not have permission to delete this message'},
                status=status.HTTP_403_FORBIDDEN
            )

        success = ChatMessageService.delete_message(message, request.user)

        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        return Response(
            {'error': 'Could not delete message'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

class MarkReadView(APIView):
    """
    Mark all messages in a room as read.
    
    POST /api/v1/chat/rooms/<room_id>/mark-read/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Mark room messages as read")
    def post(self, request, room_id):
        """Mark all messages in room as read for current user."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # Check access permission
        if not ChatRoomService.check_room_access(room, request.user):
            return Response(
                {'error': 'Access denied to this room'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        count = ChatMessageService.mark_messages_as_read(room, request.user)
        
        return Response({
            'message': 'Messages marked as read',
            'room_id': str(room.id),
            'marked_count': count,
        })


class OnlineUsersView(APIView):
    """
    Get online users in a room.
    
    GET /api/v1/chat/rooms/<room_id>/online/
    
    Note: For real-time status, use the WebSocket presence consumer.
    This endpoint returns room participants.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get online users in room")
    def get(self, request, room_id):
        """Get users in the room (participants list)."""
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        # Check access permission
        if not ChatRoomService.check_room_access(room, request.user):
            return Response(
                {'error': 'Access denied to this room'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if room.room_type == ChatRoom.RoomType.GLOBAL:
            return Response({
                'room_id': str(room.id),
                'room_type': 'global',
                'message': 'Global chat - all authenticated users can participate',
                'online_count': 0,  # Would need Redis to track actual online count
            })
        
        participants = room.participants.filter(is_active=True).values(
            'id', 'username', 'email'
        )
        
        return Response({
            'room_id': str(room.id),
            'participants': list(participants),
            'count': participants.count(),
        })


# =============================================================================
# UTILITY VIEWS
# =============================================================================

class MessageSearchView(APIView):
    """
    Search messages across user's accessible rooms.
    
    GET /api/v1/chat/search/?query=<text>&room_id=<optional>&limit=<optional>
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Search messages",
        parameters=[
            OpenApiParameter(name='query', description='Search text (min 2 chars)', required=True),
            OpenApiParameter(name='room_id', description='Limit search to specific room', required=False),
            OpenApiParameter(name='limit', description='Max results (default 20, max 100)', required=False),
        ],
        responses={200: ChatMessageSerializer(many=True)}
    )
    def get(self, request):
        """Search messages across all accessible rooms."""
        serializer = MessageSearchSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        
        results = ChatMessageService.search_messages(
            user=request.user,
            query=serializer.validated_data['query'],
            room_id=serializer.validated_data.get('room_id'),
            limit=serializer.validated_data.get('limit', 20)
        )
        
        return Response({
            'query': serializer.validated_data['query'],
            'results': results,
            'count': len(results),
        })


class UnreadCountView(APIView):
    """
    Get unread message count across all rooms.
    
    GET /api/v1/chat/unread/?project_id=<optional>
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get unread message counts",
        parameters=[
            OpenApiParameter(name='project_id', description='Filter by project UUID to get specific project counts', required=False),
        ]
    )
    def get(self, request):
        """Get unread message counts per room and total."""
        rooms_data = ChatRoomService.get_user_rooms(request.user)
        
        # Grab the project_id from the query parameters if it exists
        target_project_id = request.query_params.get('project_id')
        
        unread_by_room = {}
        for room in rooms_data:
            if room['unread_count'] > 0:
                
                # If the frontend requested a specific project, skip rooms that don't match
                room_project_id = str(room.get('project_id')) if room.get('project_id') else None
                if target_project_id and room_project_id != str(target_project_id):
                    continue
                    
                # Prefer the actual message time, fallback to room update time
                last_activity = room['updated_at']
                if room.get('last_message') and room['last_message'].get('created_at'):
                     last_activity = room['last_message']['created_at']

                unread_by_room[room['id']] = {
                    'name': room['name'],
                    'unread_count': room['unread_count'],
                    'room_type': room['room_type'],
                    'last_message_at': last_activity,
                    'project_id': room.get('project_id')  
                }
        
        thread_unread = sum(r['unread_count'] for r in unread_by_room.values() if r['room_type'] == 'thread')
        normal_chat_unread = sum(r['unread_count'] for r in unread_by_room.values() if r['room_type'] != 'thread')
        
        return Response({
            'total_unread': normal_chat_unread,
            'thread_unread': thread_unread, 
            'rooms_with_unread': len(unread_by_room),
            'by_room': unread_by_room,
        })
class DeleteMessageView(APIView):
    """
    Soft delete a message.
    
    DELETE /api/v1/chat/rooms/<room_id>/messages/<message_id>/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Delete a message")
    def delete(self, request, room_id, message_id):
        room = get_object_or_404(ChatRoom, id=room_id, is_active=True)
        
        message = get_object_or_404(
            ChatMessage, 
            id=message_id, 
            room=room
        )

        # Use existing Permission Service
        if not ChatPermissionService.can_delete_message(request.user, message):
            return Response(
                {'error': 'You do not have permission to delete this message'},
                status=status.HTTP_403_FORBIDDEN
            )

        success = ChatMessageService.delete_message(message, request.user)

        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        return Response(
            {'error': 'Could not delete message'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

class CreateThreadRoomView(APIView):
    """
    Create a standalone thread room for a project.
    
    POST /api/v1/chat/rooms/thread/
    Body: { "project_id": <uuid>, "name": "My Issue Topic" }
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create project thread room",
        request=CreateThreadRoomSerializer,
        responses={201: ChatRoomDetailSerializer}
    )
    def post(self, request):
        serializer = CreateThreadRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        project_id = serializer.validated_data['project_id']
        name = serializer.validated_data['name']
        parent_msg_id = serializer.validated_data.get('parent_message_id')
        
        from apps.projects.models import Project
        project = get_object_or_404(Project, id=project_id)
            
        # This calls the updated service method
        room = ChatRoomService.create_thread_room(
            project=project,
            name=name,
            created_by=request.user,
            parent_message_id=parent_msg_id
        )
        
        response_serializer = ChatRoomDetailSerializer(
            room,
            context={'request': request}
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
# class GetAIBotRoomView(APIView):
#     """
#     Get or create the personal AI Assistant room for the current user.
#     GET /api/v1/chat/rooms/ai-bot/
#     """
#     permission_classes = [IsAuthenticated]

#     @extend_schema(summary="Get or create personal AI Bot room", responses={200: ChatRoomDetailSerializer})
#     def get(self, request):
#         room = ChatRoomService.get_or_create_ai_room(request.user)
#         serializer = ChatRoomDetailSerializer(room, context={'request': request})
#         return Response(serializer.data)