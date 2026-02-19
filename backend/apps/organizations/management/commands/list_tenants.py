"""
Management command: list_tenants

Shows all organizations with key stats.

Usage:
    python manage.py list_tenants
    python manage.py list_tenants --active-only
"""

from django.core.management.base import BaseCommand

from apps.organizations.services import TenantOnboardingService
from apps.organizations.models import Organization


class Command(BaseCommand):
    help = "List all tenants with their stats."

    def add_arguments(self, parser):
        parser.add_argument(
            "--active-only",
            action="store_true",
            help="Show only active tenants.",
        )

    def handle(self, *args, **options):
        qs = Organization.objects.all()
        if options["active_only"]:
            qs = qs.filter(is_active=True)

        if not qs.exists():
            self.stdout.write("No organizations found.")
            return

        self.stdout.write(self.style.MIGRATE_HEADING("\n ZanFlow Tenants\n"))
        self.stdout.write(
            f"  {'ID':<5} {'Name':<25} {'Slug':<25} {'Active':<8} "
            f"{'Users':<7} {'Projects':<10} {'Tasks':<7} {'Teams':<7}"
        )
        self.stdout.write("  " + "─" * 100)

        for org in qs:
            try:
                stats = TenantOnboardingService.get_tenant_stats(org.id)
                self.stdout.write(
                    f"  {org.id:<5} {org.name:<25} {org.slug:<25} "
                    f"{'✓' if org.is_active else '✗':<8} "
                    f"{stats['users']:<7} {stats['projects']:<10} "
                    f"{stats['tasks']:<7} {stats['teams']:<7}"
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"  {org.id:<5} {org.name:<25} Error: {e}")
                )

        self.stdout.write("")
