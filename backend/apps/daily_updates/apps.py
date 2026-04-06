from django.apps import AppConfig

class DailyUpdatesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # Change this from 'daily_updates' to 'apps.daily_updates'
    name = 'apps.daily_updates'
    def ready(self):
        import apps.daily_updates.signals