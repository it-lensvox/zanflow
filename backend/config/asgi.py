"""
ASGI config for ZanFlow project.
"""
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

# 1. Import your existing chat routing and middleware
from apps.chat.routing import websocket_urlpatterns as chat_urlpatterns
from apps.chat.middleware import JWTAuthMiddleware

# 2. Import your NEW AI bot routing (from the urls.py we updated earlier)
from apps.task_ai.urls import websocket_urlpatterns as ai_urlpatterns

# 3. Combine both lists of URL patterns
combined_websocket_urlpatterns = chat_urlpatterns + ai_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(combined_websocket_urlpatterns)
    ),
})