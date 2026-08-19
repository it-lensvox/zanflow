"""
WebSocket URL routing for chat application.
"""
from django.urls import re_path

from .consumers import  GatewayConsumer

websocket_urlpatterns = [
    # # Global connection - receives messages from ALL user's rooms
    # re_path(r'ws/chat/global/$', GlobalChatConsumer.as_asgi()),
    
    # # Room-specific connection - for active chat
    # re_path(r'ws/chat/(?P<room_id>[0-9a-f-]+)/$', ChatConsumer.as_asgi()),
    
    # # Notifications
    # re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
    
    # # Presence
    # re_path(r'ws/presence/$', OnlineStatusConsumer.as_asgi()),

    re_path(r'ws/gateway/$', GatewayConsumer.as_asgi()),
]