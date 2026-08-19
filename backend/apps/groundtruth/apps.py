# apps/groundtruth/apps.py
from django.apps import AppConfig

class GroundtruthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.groundtruth' # Make sure this matches your exact app path

    def ready(self):
        # Explicitly import the signals file so Django registers the listeners
        import apps.groundtruth.signals