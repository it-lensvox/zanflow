import json
import logging
import asyncio
from django.core.cache import cache  # <--- NEW: Import Django's cache
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

        # 1. Add user to online cache (handles multiple tabs)
        await self.add_user_to_online_cache()

        # 2. Subscribe to Groups
        self.user_group_global = f"user_{self.user.id}_global"
        await self.channel_layer.group_add(self.user_group_global, self.channel_name)

        self.user_group_direct = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group_direct, self.channel_name)

        await self.subscribe_to_chat_rooms()
        
        await self.channel_layer.group_add("presence", self.channel_name)

        await self.accept()
        logger.info(f"User {self.user.id} connected to Gateway")

        # 3. [NEW] Send the list of currently online users to THIS newly connected user
        current_online_users = await self.get_online_users_cache()
        await self.send(text_data=json.dumps({
            'type': 'PRESENCE_SYNC',
            'online_users': current_online_users
        }))

        # 4. Broadcast "I am Online" to everyone else
        await self.channel_layer.group_send(
            "presence",
            {
                "type": "presence_signal",
                "status": "online",
                "user_id": self.user.id,
                "username": self.user.username
            }
        )

        await self.send(text_data=json.dumps({
            'type': 'GATEWAY_CONNECTED',
            'user_id': self.user.id
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'user') and self.user.is_authenticated:
            # 1. [NEW] Remove from cache and check if this was their LAST open tab
            is_fully_offline = await self.remove_user_from_online_cache()

            # 2. Only broadcast offline if they have no other active connections
            if is_fully_offline:
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
        
        if hasattr(self, 'user_group_direct'):
            await self.channel_layer.group_discard(self.user_group_direct, self.channel_name)
            
        await self.channel_layer.group_discard("presence", self.channel_name)
        
        logger.info(f"User {getattr(self, 'user', 'Unknown')} disconnected from Gateway")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            command = data.get('command')

            if command == 'send_message':
                await self.process_chat_message(data)
                
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
    # CORE HANDLERS
    # ==================================================================
    async def gateway_message(self, event):
        message_payload = event.get('data')
        if message_payload:
            await self.send(text_data=json.dumps(message_payload))

    @database_sync_to_async
    def process_chat_message(self, data):
        try:
            room_id = data.get('room_id')
            content = data.get('content')

            if not room_id or not content:
                return

            room = ChatRoom.original_objects.get(id=room_id)
            
            # Set org + workspace context from the room so the message
            # is saved with correct tenant/workspace IDs.
            # WebSocket consumers run outside DRF, so thread-local
            # context is never set — we must pass these explicitly.
            from apps.organizations.context import set_current_organization, set_current_workspace
            if room.organization_id:
                set_current_organization(room.organization_id)
            if room.workspace_id:
                set_current_workspace(room.workspace_id)

            ChatMessageService.create_message(
                room=room,
                sender=self.user,
                content=content
            )
        except ChatRoom.DoesNotExist:
            logger.error(f"User {self.user.id} tried to send to non-existent room {room_id}")
        except Exception as e:
            logger.error(f"Failed to process chat message: {e}")

    # async def invoke_zanflow_ai(self, room_id, content, user_id):
    #     await asyncio.sleep(0.5) 
    #     try:
    #         logger.info(f"AI Triggered in room {room_id} with query: {content}")
    #         await database_sync_to_async(ChatMessageService.process_zanflow_ai)(
    #             room_id=room_id, 
    #             prompt_text=content, 
    #             user_id=user_id
    #         )
    #     except Exception as e:
    #         logger.error(f"Error invoking Zanflow AI: {e}")

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
        # Don't send the user's own presence signal back to themselves
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

    async def chat_message_delete(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'data': event['event_data']
        }))

    @database_sync_to_async
    def get_user_room_slugs(self):
        # Use original_objects because WebSocket consumers have no
        # tenant/workspace thread-local context set
        member_rooms = ChatRoomMembership.objects.filter(
            user=self.user
        ).values_list('room__slug', flat=True)

        global_rooms = ChatRoom.original_objects.filter(
            room_type=ChatRoom.RoomType.GLOBAL, 
            is_active=True,
            organization_id=getattr(self.user, 'organization_id', None),
        ).values_list('slug', flat=True)

        return list(set(member_rooms) | set(global_rooms))

    # ==================================================================
    # [NEW] PRESENCE CACHE HELPERS
    # ==================================================================
    @database_sync_to_async
    def add_user_to_online_cache(self):
        """Increments connection count for the user."""
        online_users = cache.get('chat_online_users', {})
        online_users[self.user.id] = online_users.get(self.user.id, 0) + 1
        cache.set('chat_online_users', online_users, timeout=86400) # 24 hr TTL

    @database_sync_to_async
    def remove_user_from_online_cache(self):
        """Decrements connection count. Returns True if count hit 0 (fully offline)."""
        online_users = cache.get('chat_online_users', {})
        is_offline = False

        if self.user.id in online_users:
            online_users[self.user.id] -= 1
            if online_users[self.user.id] <= 0:
                del online_users[self.user.id]
                is_offline = True
            cache.set('chat_online_users', online_users, timeout=86400)

        return is_offline

    @database_sync_to_async
    def get_online_users_cache(self):
        """Returns a list of all currently connected user IDs."""
        online_users = cache.get('chat_online_users', {})
        return list(online_users.keys())