"""
apps/org_config/apps.py  (PM Backend)
"""

from django.apps import AppConfig


class OrgConfigConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "apps.org_config"
    verbose_name       = "Org Config (S3 + Redis)"

    def ready(self):
        pass  # No signals needed in product backends — Central handles writes