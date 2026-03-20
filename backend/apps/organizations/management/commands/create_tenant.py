"""
Management command: create_tenant

Industry-standard CLI for tenant provisioning.

Usage:
    python manage.py create_tenant "Acme Corp" --admin-email admin@acme.com --admin-password securepass123
    python manage.py create_tenant "Acme Corp" --admin-email admin@acme.com  (prompts for password)
"""

import getpass

from django.core.management.base import BaseCommand, CommandError

from apps.organizations.services import TenantOnboardingService


class Command(BaseCommand):
    help = "Create a new tenant (organization) with an admin user."

    def add_arguments(self, parser):
        parser.add_argument("name", type=str, help="Organization name")
        parser.add_argument("--slug", type=str, help="URL-safe slug (auto-generated if omitted)")
        parser.add_argument("--admin-username", type=str, help="Admin username (defaults to org slug + '_admin')")
        parser.add_argument("--admin-email", type=str, required=True, help="Admin user email")
        parser.add_argument("--admin-password", type=str, help="Admin password (prompted if omitted)")

    def handle(self, *args, **options):
        name = options["name"]
        slug = options.get("slug")
        admin_email = options["admin_email"]
        admin_password = options.get("admin_password")
        admin_username = options.get("admin_username")

        # Auto-generate username from org name if not provided
        if not admin_username:
            from django.utils.text import slugify
            admin_username = slugify(name).replace("-", "_") + "_admin"

        # Prompt for password securely if not provided
        if not admin_password:
            admin_password = getpass.getpass("Enter admin password: ")
            confirm = getpass.getpass("Confirm admin password: ")
            if admin_password != confirm:
                raise CommandError("Passwords do not match.")

        try:
            result = TenantOnboardingService.create_tenant(
                name=name,
                admin_username=admin_username,
                admin_email=admin_email,
                admin_password=admin_password,
                slug=slug,
            )

            org = result["organization"]
            user = result["admin_user"]

            self.stdout.write(self.style.SUCCESS(f"\n✓ Tenant created successfully!\n"))
            self.stdout.write(f"  Organization:  {org.name}")
            self.stdout.write(f"  ID:            {org.id}")
            self.stdout.write(f"  Slug:          {org.slug}")
            self.stdout.write(f"  Admin User:    {user.username}")
            self.stdout.write(f"  Admin Email:   {user.email}")
            self.stdout.write(f"  Role:          {user.role}")
            self.stdout.write(f"  Superuser:     No (tenant admin only)")
            self.stdout.write(f"\n  This user has full power to manage members, projects,")
            self.stdout.write(f"  and all data within '{org.name}'.")
            self.stdout.write(f"  Cannot access other tenants or platform settings.\n")

        except ValueError as e:
            raise CommandError(str(e))