"""
apps/rbac/management/commands/seed_platform_roles.py

Seeds the 4 Dyuksa platform roles that apply across ALL platforms.

These roles are NOT PM roles, NOT HRMS roles, NOT CRM roles.
They sit above all platforms and are seeded ONCE — before any
platform-specific seed command runs.

    Owner         — full tenant access, created at signup
    Org Admin     — manages members, roles, workspaces across all platforms
    Billing Admin — subscription and billing only, zero data access
    Auditor       — read-everywhere, cannot create/update/delete anything

Run this FIRST before seed_hrms_roles or any other seed command:
    python manage.py seed_platform_roles

Safe to re-run — uses get_or_create. Idempotent.
"""

from django.core.management.base import BaseCommand
from apps.rbac.models import Role


PLATFORM_ROLES = [
    (
        "owner",
        "Owner",
        "Full tenant access across all platforms. Created at signup. Cannot be revoked except by Dyuksa.",
    ),
    (
        "org_admin",
        "Org Admin",
        "Manages workspaces, members, and role assignments across all platforms. Cannot change billing.",
    ),
    (
        "billing_admin",
        "Billing Admin",
        "Manages subscription, payment, and plan changes only. Zero access to PM, HRMS, or CRM data.",
    ),
    (
        "auditor",
        "Auditor",
        "Read-only access to everything across all platforms and all audit logs. Cannot create, update, or delete.",
    ),
]


class Command(BaseCommand):
    help = "Seed the 4 Dyuksa platform roles (Owner, Org Admin, Billing Admin, Auditor)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be created without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no changes will be made.\n"))

        self.stdout.write("── Seeding platform roles ────────────────────────")

        created = 0
        for code, display_name, description in PLATFORM_ROLES:
            if dry_run:
                self.stdout.write(f"  Would create: {code} [all platforms]")
                created += 1
                continue

            _, new = Role.objects.get_or_create(
                tenant_id=None,
                code=code,
                platform="all",
                defaults={
                    "display_name": display_name,
                    "role_class":   Role.CLASS_PLATFORM,
                    "is_system":    True,
                    "description":  description,
                },
            )
            if new:
                self.stdout.write(f"  Created : {code}")
                created += 1
            else:
                self.stdout.write(f"  Exists  : {code} — skipped")

        action = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"\n{'DRY RUN ' if dry_run else ''}Done. "
            f"{action} {created} platform role(s).\n"
            f"\nRun next:\n"
            f"  python manage.py seed_hrms_roles\n"
        ))
