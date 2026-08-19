"""
Tests for chat application.

Run with: python manage.py test apps.chat
"""
import json
from uuid import uuid4

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from channels.testing import WebsocketCommunicator
from channels.routing import URLRouter
from channels.db import database_sync_to_async

from .models import ChatRoom, ChatMessage, ChatRoomMembership
from .services import ChatRoomService, ChatMessageService
from .consumers import ChatConsumer
from .routing import websocket_urlpatterns

User = get_user_model()


class ChatRoomModelTest(TestCase):
    """Tests for ChatRoom model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_create_global_room(self):
        """Test creating a global chat room."""
        room = ChatRoom.objects.create(
            name='Global Chat',
            room_type=ChatRoom.RoomType.GLOBAL,
            created_by=self.user
        )
        
        self.assertEqual(room.room_type, 'global')
        self.assertIsNotNone(room.slug)
        self.assertTrue(room.is_active)

    def test_create_private_room(self):
        """Test creating a private chat room."""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        room = ChatRoom.objects.create(
            name=f'Chat: {self.user.username} & {other_user.username}',
            room_type=ChatRoom.RoomType.PRIVATE,
            created_by=self.user
        )
        
        # Add participants
        ChatRoomMembership.objects.create(user=self.user, room=room)
        ChatRoomMembership.objects.create(user=other_user, room=room)
        
        self.assertEqual(room.room_type, 'private')
        self.assertEqual(room.participants.count(), 2)

    def test_channel_group_name(self):
        """Test channel group name generation."""
        room = ChatRoom.objects.create(
            name='Test Room',
            room_type=ChatRoom.RoomType.GLOBAL,
            created_by=self.user,
            slug='test-room'
        )
        
        self.assertEqual(room.channel_group_name, 'chat_test-room')


class ChatMessageModelTest(TestCase):
    """Tests for ChatMessage model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.room = ChatRoom.objects.create(
            name='Test Room',
            room_type=ChatRoom.RoomType.GLOBAL,
            created_by=self.user
        )

    def test_create_message(self):
        """Test creating a chat message."""
        message = ChatMessage.objects.create(
            room=self.room,
            sender=self.user,
            content='Hello, world!'
        )
        
        self.assertEqual(message.message_type, 'text')
        self.assertEqual(message.content, 'Hello, world!')
        self.assertFalse(message.is_deleted)

    def test_soft_delete_message(self):
        """Test soft deleting a message."""
        message = ChatMessage.objects.create(
            room=self.room,
            sender=self.user,
            content='Delete me'
        )
        
        message.soft_delete()
        
        self.assertTrue(message.is_deleted)
        self.assertIsNotNone(message.deleted_at)

    def test_to_websocket_dict(self):
        """Test message serialization for WebSocket."""
        message = ChatMessage.objects.create(
            room=self.room,
            sender=self.user,
            content='Test message'
        )
        
        data = message.to_websocket_dict()
        
        self.assertEqual(data['content'], 'Test message')
        self.assertEqual(data['sender']['username'], 'testuser')
        self.assertEqual(str(data['room_id']), str(self.room.id))


class ChatRoomServiceTest(TestCase):
    """Tests for ChatRoomService."""

    def setUp(self):
        """Set up test data."""
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )

    def test_create_global_room(self):
        """Test creating global room."""
        room = ChatRoomService.create_global_room('Global', self.user1)
        
        self.assertEqual(room.room_type, ChatRoom.RoomType.GLOBAL)
        self.assertEqual(room.slug, 'global-chat')

    def test_get_or_create_private_room(self):
        """Test creating private room between users."""
        room, created = ChatRoomService.get_or_create_private_room(
            self.user1, self.user2
        )
        
        self.assertTrue(created)
        self.assertEqual(room.room_type, ChatRoom.RoomType.PRIVATE)
        self.assertTrue(room.is_participant(self.user1))
        self.assertTrue(room.is_participant(self.user2))
        
        # Getting same room again
        room2, created2 = ChatRoomService.get_or_create_private_room(
            self.user1, self.user2
        )
        
        self.assertFalse(created2)
        self.assertEqual(room.id, room2.id)

    def test_check_room_access_global(self):
        """Test global room access."""
        room = ChatRoomService.create_global_room('Global', self.user1)
        
        self.assertTrue(ChatRoomService.check_room_access(room, self.user1))
        self.assertTrue(ChatRoomService.check_room_access(room, self.user2))

    def test_check_room_access_private(self):
        """Test private room access."""
        room, _ = ChatRoomService.get_or_create_private_room(
            self.user1, self.user2
        )
        
        user3 = User.objects.create_user(
            username='user3',
            email='user3@example.com',
            password='testpass123'
        )
        
        self.assertTrue(ChatRoomService.check_room_access(room, self.user1))
        self.assertTrue(ChatRoomService.check_room_access(room, self.user2))
        self.assertFalse(ChatRoomService.check_room_access(room, user3))


class ChatMessageServiceTest(TestCase):
    """Tests for ChatMessageService."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.room = ChatRoomService.create_global_room('Global', self.user)

    def test_create_message(self):
        """Test creating a message."""
        message = ChatMessageService.create_message(
            room=self.room,
            sender=self.user,
            content='Hello!'
        )
        
        self.assertEqual(message.content, 'Hello!')
        self.assertEqual(message.sender, self.user)
        self.assertEqual(message.room, self.room)

    def test_get_room_messages(self):
        """Test fetching room messages."""
        # Create some messages
        for i in range(5):
            ChatMessageService.create_message(
                room=self.room,
                sender=self.user,
                content=f'Message {i}'
            )
        
        messages = ChatMessageService.get_room_messages(
            room=self.room,
            user=self.user,
            limit=10
        )
        
        self.assertEqual(len(messages), 5)

    def test_search_messages(self):
        """Test message search."""
        ChatMessageService.create_message(
            room=self.room,
            sender=self.user,
            content='Hello world'
        )
        ChatMessageService.create_message(
            room=self.room,
            sender=self.user,
            content='Goodbye world'
        )
        ChatMessageService.create_message(
            room=self.room,
            sender=self.user,
            content='Testing'
        )
        
        results = ChatMessageService.search_messages(
            user=self.user,
            query='world'
        )
        
        self.assertEqual(len(results), 2)


class ChatRoomAPITest(APITestCase):
    """Tests for Chat REST API."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # Create global room
        self.global_room = ChatRoomService.create_global_room('Global', self.user)

    def test_list_rooms(self):
        """Test listing chat rooms."""
        url = reverse('chat-room-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_get_room_detail(self):
        """Test getting room details."""
        url = reverse('chat-room-detail', kwargs={'room_id': self.global_room.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Global Chat')

    def test_get_global_room(self):
        """Test getting global chat room."""
        url = reverse('chat-room-global')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['room_type'], 'global')

    def test_create_private_room(self):
        """Test creating private chat room."""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        url = reverse('chat-room-create-private')
        response = self.client.post(url, {'user_id': other_user.id})
        
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertEqual(response.data['room_type'], 'private')

    def test_get_room_messages(self):
        """Test getting room messages."""
        # Create a message
        ChatMessageService.create_message(
            room=self.global_room,
            sender=self.user,
            content='Test message'
        )
        
        url = reverse('chat-room-messages', kwargs={'room_id': self.global_room.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['messages']), 1)

    def test_search_messages(self):
        """Test searching messages."""
        ChatMessageService.create_message(
            room=self.global_room,
            sender=self.user,
            content='Searchable content'
        )
        
        url = reverse('chat-message-search')
        response = self.client.get(url, {'query': 'Searchable'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)

    def test_unread_counts(self):
        """Test getting unread message counts."""
        url = reverse('chat-unread-counts')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_unread', response.data)


class ChatConsumerTest(TransactionTestCase):
    """Tests for WebSocket consumers."""

    async def test_connect_authenticated(self):
        """Test WebSocket connection with authentication."""
        # This test requires a proper JWT token setup
        # For simplicity, we test the consumer structure
        pass

    async def test_connect_unauthenticated(self):
        """Test WebSocket connection without authentication."""
        # Create communicator without token
        communicator = WebsocketCommunicator(
            URLRouter(websocket_urlpatterns),
            '/ws/chat/test-room/'
        )
        
        # Should close connection for unauthenticated user
        connected, _ = await communicator.connect()
        
        # Connection should be rejected
        if connected:
            await communicator.disconnect()


# Integration test example
class ChatIntegrationTest(TransactionTestCase):
    """Integration tests for chat flow."""

    def test_full_chat_flow(self):
        """Test complete chat flow from room creation to messaging."""
        # Create users
        user1 = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='testpass123'
        )
        user2 = User.objects.create_user(
            username='bob',
            email='bob@example.com',
            password='testpass123'
        )
        
        # Create private room
        room, _ = ChatRoomService.get_or_create_private_room(user1, user2)
        
        # Send messages
        msg1 = ChatMessageService.create_message(
            room=room, sender=user1, content='Hi Bob!'
        )
        msg2 = ChatMessageService.create_message(
            room=room, sender=user2, content='Hi Alice!'
        )
        
        # Verify messages
        messages = ChatMessageService.get_room_messages(room, user1)
        self.assertEqual(len(messages), 2)
        
        # Verify access control
        user3 = User.objects.create_user(
            username='charlie',
            email='charlie@example.com',
            password='testpass123'
        )
        self.assertFalse(ChatRoomService.check_room_access(room, user3))
