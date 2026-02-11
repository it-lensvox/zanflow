"""
URL configuration for chat REST API.

All endpoints are prefixed with /api/v1/chat/
All URLs explicitly defined without router.
"""
from django.urls import path

from .views import (
    # Room views
    ChatRoomListView,
    ChatRoomDetailView,
    CreatePrivateRoomView,
    CreateProjectRoomView,
    GetGlobalRoomView,
    JoinRoomView,
    LeaveRoomView,
    AddParticipantView,
    RoomSettingsView,
    
    # Message views
    RoomMessagesListView,
    RoomMessageDetailView,
    
    # Utility views
    MessageSearchView,
    MarkReadView,
    OnlineUsersView,
    UnreadCountView,
    UserListView,
    SendMessageView,
    DeleteMessageView
)

urlpatterns = [
    # ==========================================================================
    # ROOM ENDPOINTS
    # ==========================================================================
    
    # List all rooms for current user
     path('users/', UserListView.as_view(), name='user-list'),
    # GET /api/v1/chat/rooms/
    path(
        'rooms/',
        ChatRoomListView.as_view(),
        name='chat-room-list'
    ),
    
    # Get or create global chat room (must be before room_id path)
    # GET /api/v1/chat/rooms/global/
    path(
        'rooms/global/',
        GetGlobalRoomView.as_view(),
        name='chat-room-global'
    ),
    
    # Create private chat room with another user
    # POST /api/v1/chat/rooms/private/
    path(
        'rooms/private/',
        CreatePrivateRoomView.as_view(),
        name='chat-room-create-private'
    ),
    
    # Create project chat room
    # POST /api/v1/chat/rooms/project/
    path(
        'rooms/project/',
        CreateProjectRoomView.as_view(),
        name='chat-room-create-project'
    ),
    
    # Get room details
    # GET /api/v1/chat/rooms/<uuid:room_id>/
    path(
        'rooms/<uuid:room_id>/',
        ChatRoomDetailView.as_view(),
        name='chat-room-detail'
    ),
    
    # Join a chat room
    # POST /api/v1/chat/rooms/<uuid:room_id>/join/
    path(
        'rooms/<uuid:room_id>/join/',
        JoinRoomView.as_view(),
        name='chat-room-join'
    ),
    
    # Leave a chat room
    # POST /api/v1/chat/rooms/<uuid:room_id>/leave/
    path(
        'rooms/<uuid:room_id>/leave/',
        LeaveRoomView.as_view(),
        name='chat-room-leave'
    ),
    
    # Add participant to a room
    # POST /api/v1/chat/rooms/<uuid:room_id>/add-participant/
    path(
        'rooms/<uuid:room_id>/add-participant/',
        AddParticipantView.as_view(),
        name='chat-room-add-participant'
    ),
    
    # Update room settings (mute/unmute)
    # PATCH /api/v1/chat/rooms/<uuid:room_id>/settings/
    path(
        'rooms/<uuid:room_id>/settings/',
        RoomSettingsView.as_view(),
        name='chat-room-settings'
    ),
    
    # ==========================================================================
    # MESSAGE ENDPOINTS
    # ==========================================================================
    
    # List messages in a room
    # GET /api/v1/chat/rooms/<uuid:room_id>/messages/
    path(
        'rooms/<uuid:room_id>/messages/',
        RoomMessagesListView.as_view(),
        name='chat-room-messages'
    ),
    
    # Get single message details
    # GET /api/v1/chat/rooms/<uuid:room_id>/messages/<uuid:message_id>/
    path(
        'rooms/<uuid:room_id>/messages/<uuid:message_id>/',
        RoomMessageDetailView.as_view(),
        name='chat-message-detail'
    ),
    
    # Mark all messages in room as read
    # POST /api/v1/chat/rooms/<uuid:room_id>/mark-read/
    path(
        'rooms/<uuid:room_id>/mark-read/',
        MarkReadView.as_view(),
        name='chat-room-mark-read'
    ),
    
    # Get online users in a room
    # GET /api/v1/chat/rooms/<uuid:room_id>/online/
    path(
        'rooms/<uuid:room_id>/online/',
        OnlineUsersView.as_view(),
        name='chat-room-online-users'
    ),
    
    # ==========================================================================
    # UTILITY ENDPOINTS
    # ==========================================================================
    
    # Search messages across rooms
    # GET /api/v1/chat/search/?query=<text>&room_id=<optional>
    path(
        'search/',
        MessageSearchView.as_view(),
        name='chat-message-search'
    ),
    
    # Get unread message counts
    # GET /api/v1/chat/unread/
    path(
        'unread/',
        UnreadCountView.as_view(),
        name='chat-unread-counts'
    ),
    path(
        'rooms/<uuid:room_id>/send/',
        SendMessageView.as_view(),
        name='chat-room-send-message'
    ),
    path(
        'rooms/<uuid:room_id>/messages/<uuid:message_id>/',
        DeleteMessageView.as_view(),
        name='chat-message-delete'
    ),
]
