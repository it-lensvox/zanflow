import json
import logging
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatRoomMembership
from apps.chat.services import ChatMessageService

logger = logging.getLogger(__name__)
User = get_user_model()

class GatewayConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            logger.warning(f"Gateway connection rejected: Not authenticated {self.user}")
            await self.close(code=4001)
            return

        # 1. Subscribe to "Personal Global Group" (Keep this for notifications)
        self.user_group_global = f"user_{self.user.id}_global"
        await self.channel_layer.group_add(self.user_group_global, self.channel_name)

        # 2. [NEW] Subscribe to "Direct User Group" (For Chat Signals)
        # This matches the group name 'user_{id}' used in your signals.py
        self.user_group_direct = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group_direct, self.channel_name)

        # 3. Subscribe to "Chat Room Groups"
        await self.subscribe_to_chat_rooms()

        # 4. Subscribe to "Presence Group"
        await self.channel_layer.group_add("presence", self.channel_name)

        # 5. Broadcast "I am Online"
        await self.channel_layer.group_send(
            "presence",
            {
                "type": "presence_signal",
                "status": "online",
                "user_id": self.user.id,
                "username": self.user.username
            }
        )

        await self.accept()
        logger.info(f"User {self.user.id} connected to Gateway")

        await self.send(text_data=json.dumps({
            'type': 'GATEWAY_CONNECTED',
            'user_id': self.user.id
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'user') and self.user.is_authenticated:
            # Broadcast Offline
            await self.channel_layer.group_send(
                "presence",
                {
                    "type": "presence_signal",
                    "status": "offline",
                    "user_id": self.user.id
                }
            )

        # Leave groups
        if hasattr(self, 'user_group_global'):
            await self.channel_layer.group_discard(self.user_group_global, self.channel_name)
        
        # [NEW] Leave the direct group
        if hasattr(self, 'user_group_direct'):
            await self.channel_layer.group_discard(self.user_group_direct, self.channel_name)
        
        logger.info(f"User {self.user.id} disconnected from Gateway")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            command = data.get('command')

            if command == 'send_message':
                # 1. Save the user's message to the database (Sync context)
                await self.process_chat_message(data)
                
                # 2. Trigger the AI safely in the main ASYNC loop
                content = data.get('content', '')
                room_id = data.get('room_id')
                
                if content and room_id and "@dyuksa" in content.lower():
                    logger.info("Spawning background AI task...")
                    asyncio.create_task(self.invoke_zanflow_ai(room_id, content, self.user.id))

            elif command == 'join_room':
                room_slug = data.get('room_slug')
                if room_slug:
                    await self.channel_layer.group_add(f"chat_{room_slug}", self.channel_name)
            elif command == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))

        except json.JSONDecodeError:
            pass
        except Exception as e:
            logger.error(f"Error in Gateway receive: {e}")

    # ==================================================================
    # [NEW] HANDLER: GATEWAY MESSAGE (Matches signals.py)
    # ==================================================================
    async def gateway_message(self, event):
        """
        Handles 'gateway.message' events sent from signals.py.
        This is required for room_created events to reach the frontend.
        """
        # The event payload from signals.py looks like:
        # { 'type': 'gateway.message', 'data': { ... } }
        message_payload = event.get('data')
        
        if message_payload:
            await self.send(text_data=json.dumps(message_payload))

    # ==================================================================
    # LOGIC: SENDING MESSAGES
    # ==================================================================
    @database_sync_to_async
    def process_chat_message(self, data):
        try:
            room_id = data.get('room_id')
            content = data.get('content')

            if not room_id or not content:
                return

            room = ChatRoom.objects.get(id=room_id)
            
            # Save the message to the database
            message = ChatMessageService.create_message(
                room=room,
                sender=self.user,
                content=content
            )
            # Notice we REMOVED the AI trigger from here!

        except ChatRoom.DoesNotExist:
            logger.error(f"User {self.user.id} tried to send to non-existent room {room_id}")
        except Exception as e:
            logger.error(f"Failed to process chat message: {e}")

    # --- NEW METHOD: Background AI Worker ---
    async def invoke_zanflow_ai(self, room_id, content, user_id):
        """Handles the AI processing asynchronously so WebSockets don't block."""
        await asyncio.sleep(0.5)  # Brief pause to ensure the user's message broadcasts first
        
        try:
            logger.info(f"AI Triggered in room {room_id} with query: {content}")
            
            # Use database_sync_to_async to run the synchronous Bedrock call without blocking the websocket
            await database_sync_to_async(ChatMessageService.process_zanflow_ai)(
                room_id=room_id, 
                prompt_text=content, 
                user_id=user_id
            )
            
        except Exception as e:
            logger.error(f"Error invoking Zanflow AI: {e}")

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'CHAT_MESSAGE',
            'data': event['message']
        }))

    async def gateway_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'SIGNAL',
            'event': event['event'],
            'data': event['data']
        }))

    async def presence_signal(self, event):
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'PRESENCE',
                'status': event['status'], 
                'user_id': event['user_id'],
                'username': event.get('username')
            }))

    async def subscribe_to_chat_rooms(self):
        slugs = await self.get_user_room_slugs()
        for slug in slugs:
            group_name = f"chat_{slug}"
            await self.channel_layer.group_add(group_name, self.channel_name)
    # Add this method to handle the delete event sent from Service
    async def chat_message_delete(self, event):
        """
        Handlers for 'chat_message_delete' type sent from channel_layer.
        """
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'data': event['event_data']
        }))
    @database_sync_to_async
    def get_user_room_slugs(self):
        member_rooms = ChatRoomMembership.objects.filter(
            user=self.user
        ).values_list('room__slug', flat=True)

        global_rooms = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.GLOBAL, 
            is_active=True
        ).values_list('slug', flat=True)

        return list(set(member_rooms) | set(global_rooms))