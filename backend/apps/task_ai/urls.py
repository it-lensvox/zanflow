from django.urls import path
from .views import SuggestTaskAIView, RefineTaskTextView, DyuksaChatAgentView
from . import consumers
urlpatterns = [
    path('suggest-task/', SuggestTaskAIView.as_view(), name='suggest-task-ai'),
    path('refine-text/', RefineTaskTextView.as_view(), name='refine-task-text'),
    path('chat/agent/', DyuksaChatAgentView.as_view(), name='chat-agent'),
]
websocket_urlpatterns = [
    path('ws/ai-bot/', consumers.AIBotConsumer.as_asgi()),
]