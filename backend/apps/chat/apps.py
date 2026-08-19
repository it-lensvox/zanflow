"""
Chat application configuration.
"""
from django.apps import AppConfig


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.chat'
    verbose_name = 'Chat & Messaging'

    def ready(self):
        """
        Import signals when app is ready.
        # """
        import apps.chat.signals