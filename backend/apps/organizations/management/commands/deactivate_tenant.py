"""
Management command: deactivate_tenant

Safely deactivates a tenant and all its users.

Usage:
    python manage.py deactivate_tenant 3
    python manage.py deactivate_tenant 3 --force   (skip confirmation)
"""

from django.core.management.base import BaseCommand, CommandError

from apps.organizations.models import Organization
from apps.organizations.services import TenantOnboardingService


class Command(BaseCommand):
    help = "Deactivate a tenant (organization) and all its users."

    def add_arguments(self, parser):
        parser.add_argument("org_id", type=int, help="Organization ID to deactivate")
        parser.add_argument("--force", action="store_true", help="Skip confirmation prompt")

    def handle(self, *args, **options):
        org_id = options["org_id"]

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            raise CommandError(f"Organization with ID {org_id} not found.")

        if not org.is_active:
            self.stdout.write(self.style.WARNING(f"'{org.name}' is already deactivated."))
            return

        # Show stats before deactivation
        stats = TenantOnboardingService.get_tenant_stats(org_id)
        self.stdout.write(f"\n  Organization: {org.name} (ID: {org.id})")
        self.stdout.write(f"  Users: {stats['users']}")
        self.stdout.write(f"  Projects: {stats['projects']}")
        self.stdout.write(f"  Tasks: {stats['tasks']}")

        if not options["force"]:
            confirm = input(f"\n  Deactivate '{org.name}' and all its users? [y/N]: ")
            if confirm.lower() != "y":
                self.stdout.write("Cancelled.")
                return

        TenantOnboardingService.deactivate_tenant(org_id)
        self.stdout.write(self.style.SUCCESS(f"\n✓ '{org.name}' has been deactivated."))
