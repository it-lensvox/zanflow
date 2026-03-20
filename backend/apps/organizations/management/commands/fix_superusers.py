"""
Management command: fix_superusers

One-time fix: Removes superuser status from all tenant admins
outside Production Team (org_id=1). Only platform owners should
be superusers.

Usage:
    python manage.py fix_superusers --dry-run   # preview
    python manage.py fix_superusers              # execute
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Remove superuser status from non-platform-owner users."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without applying them.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        dry_run = options["dry_run"]

        # Find all superusers NOT in Production Team (org_id=1)
        wrong_superusers = User.objects.filter(
            is_superuser=True,
        ).exclude(
            organization_id=1,
        )

        count = wrong_superusers.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No issues found. All superusers belong to Production Team."))
            return

        self.stdout.write(f"\nFound {count} user(s) with superuser status outside Production Team:\n")

        for user in wrong_superusers:
            org_name = user.organization.name if user.organization else "No Org"
            self.stdout.write(
                f"  - {user.username} ({user.email}) → Org: {org_name} (ID: {user.organization_id})"
            )

        if dry_run:
            self.stdout.write(self.style.WARNING("\n=== DRY RUN — no changes made ==="))
            return

        updated = wrong_superusers.update(is_superuser=False)
        self.stdout.write(self.style.SUCCESS(f"\n✓ Removed superuser from {updated} user(s)."))
        self.stdout.write("  These users retain role='admin' and full power within their own org.")