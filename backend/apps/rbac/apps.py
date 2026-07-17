from django.apps import AppConfig


class RbacConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name               = "apps.rbac"
    verbose_name       = "Role Based Access Control"

    def ready(self):
        # Connect all signals — role depth guard + scope auto-registration
        import apps.rbac.signals  # noqa: F401