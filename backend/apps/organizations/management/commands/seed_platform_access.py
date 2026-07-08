"""
Management command: Seed Platform rows and grant 'pm' access to all existing orgs.

Run this ONCE after the 0007_platformaccess migration on every environment
(local, staging, production).

What it does in order:
    1. Ensures the three core Platform rows exist (pm, hrms, crm).
       Safe to run on any environment — uses get_or_create, never duplicates.
    2. Grants PlatformAccess(platform=pm) to every existing Organisation
       so no current PM user loses access when SSO JWT changes are deployed.
       HRMS and CRM access is NOT auto-granted — those are assigned later
       via the Superuser Admin Panel when an org subscribes.

Adding a new platform in the future (e.g. ERP):
    - Add it to CORE_PLATFORMS below and re-run the command, OR
    - Simply add a row via Django admin — no code change needed.

Usage:
    # Full run
    python manage.py seed_platform_access

    # Dry run — preview without making any changes
    python manage.py seed_platform_access --dry-run

    # Seed a specific org only
    python manage.py seed_platform_access --org-id 5
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


# ── Core platforms to ensure exist in the Platform table ──────────────────
# To add ERP or any future platform, just add a row here and re-run.
CORE_PLATFORMS = [
    {
        "key":         "pm",
        "name":        "Project Management",
        "description": "Dyuksa Project Management platform",
    },
    {
        "key":         "hrms",
        "name":        "HRMS",
        "description": "Dyuksa Human Resource Management System",
    },
    {
        "key":         "crm",
        "name":        "CRM",
        "description": "Dyuksa Customer Relationship Management",
    },
]


class Command(BaseCommand):
    help = (
        "Seed Platform rows and grant 'pm' access to all existing organisations. "
        "Run once after the 0007_platformaccess migration."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--org-id",
            type=int,
            default=None,
            help="Seed PM access for a specific organisation only (omit for all orgs).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what will happen without making any changes.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.organizations.models import Organization, Platform, PlatformAccess

        org_id  = options["org_id"]
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\n── DRY RUN (no changes will be made) ──\n")
            )

        # ── Step 1: Ensure core Platform rows exist ────────────────────────
        self.stdout.write("── Step 1: Seeding Platform table ──")

        for p in CORE_PLATFORMS:
            exists = Platform.objects.filter(key=p["key"]).exists()
            if exists:
                self.stdout.write(
                    f"  [EXISTS]  Platform '{p['key']}' ({p['name']}) — already present."
                )
            else:
                self.stdout.write(
                    f"  [CREATE]  Platform '{p['key']}' ({p['name']}) — will be created."
                )
                if not dry_run:
                    Platform.objects.create(
                        key=p["key"],
                        name=p["name"],
                        description=p["description"],
                        is_active=True,
                    )

        # ── Step 2: Grant 'pm' access to all existing orgs ────────────────
        self.stdout.write("\n── Step 2: Granting PM access to organisations ──")

        if not dry_run:
            try:
                pm_platform = Platform.objects.get(key="pm")
            except Platform.DoesNotExist:
                raise CommandError(
                    "Platform 'pm' not found after seeding. This should not happen."
                )
        else:
            pm_platform = None  # not needed for dry-run preview

        # Fetch target orgs
        if org_id is not None:
            try:
                orgs = Organization.objects.filter(id=org_id)
                if not orgs.exists():
                    raise CommandError(
                        f"Organisation with ID {org_id} does not exist."
                    )
            except ValueError:
                raise CommandError("--org-id must be a valid integer.")
        else:
            orgs = Organization.objects.all().order_by("id")

        total_orgs     = orgs.count()
        created_count  = 0
        existing_count = 0

        self.stdout.write(f"  Organisations to process: {total_orgs}\n")

        for org in orgs:
            # Check if PM access already exists for this org
            already_exists = PlatformAccess.objects.filter(
                organization=org,
                platform__key="pm",
            ).exists()

            if already_exists:
                existing_count += 1
                self.stdout.write(
                    f"  [EXISTS]  '{org.name}' (ID: {org.id}) — PM access already present."
                )
                continue

            self.stdout.write(
                f"  [CREATE]  '{org.name}' (ID: {org.id}) — will grant PM access."
            )

            if not dry_run:
                PlatformAccess.objects.create(
                    organization=org,
                    platform=pm_platform,
                    is_active=True,
                )
            created_count += 1

        # ── Summary ───────────────────────────────────────────────────────
        self.stdout.write("")

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run complete.\n"
                    f"  Platforms  : {len(CORE_PLATFORMS)} would be ensured\n"
                    f"  PM access  : {created_count} rows would be created\n"
                    f"  Skipped    : {existing_count} orgs already had PM access\n"
                    f"\nRun without --dry-run to apply changes."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✅ Done!\n"
                    f"  Platforms ensured  : {len(CORE_PLATFORMS)} (pm, hrms, crm)\n"
                    f"  PM access created  : {created_count} organisations\n"
                    f"  PM access skipped  : {existing_count} (already existed)\n"
                    f"  Total orgs         : {total_orgs}\n"
                    f"\nNext: run 'python manage.py migrate' if you haven't already,\n"
                    f"then use the Superuser Admin Panel to grant HRMS / CRM access per org."
                )
            )
