"""
Django app configuration for the teams app.
"""
from django.apps import AppConfig


class TeamsConfig(AppConfig):
    """Configuration for the teams app."""
    
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.teams"
    verbose_name = "Teams"
    
    def ready(self):
        """Import signals when app is ready."""
        try:
            import apps.teams.signals  # noqa: F401
        except ImportError:
            pass
