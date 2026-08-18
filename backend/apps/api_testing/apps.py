"""
App configuration for API Testing Platform.
"""
from django.apps import AppConfig


class ApiTestingConfig(AppConfig):
    """Configuration for the API Testing app."""
    
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.api_testing'
    verbose_name = 'API Testing & Automation Platform'
    
    def ready(self):
        """
        Import signals when the app is ready.
        This ensures signal handlers are registered.
        """
        try:
            import apps.api_testing.signals  # noqa: F401
        except ImportError:
            pass
