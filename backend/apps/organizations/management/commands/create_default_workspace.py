"""
Management command: Create a default workspace for an existing organization.

Usage:
    # Create workspace named "Lensvox" for org ID 1
    python manage.py create_default_workspace --org-id 1 --name "Lensvox"

    # Dry run (preview without making changes)
    python manage.py create_default_workspace --org-id 1 --name "Lensvox" --dry-run

    # Skip if default workspace already exists
    python manage.py create_default_workspace --org-id 1 --name "Lensvox" --skip-existing

What it does:
    1. Finds the organization by ID.
    2. Creates a workspace with the given name, marked as is_default=True.
    3. Adds ALL users in that organization as workspace members.
       - Users with role='admin' or role='manager' → workspace role 'admin'
       - Everyone else → workspace role 'member'
    4. Backfills workspace_id on all existing tenant-scoped records (projects, tasks, etc.)
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand):
    help = "Create a default workspace for an existing organization and assign all its members."

    def add_arguments(self, parser):
        parser.add_argument(
            "--org-id",
            type=int,
            required=True,
            help="ID of the organization to create the workspace for.",
        )
        parser.add_argument(
            "--name",
            type=str,
            required=True,
            help='Name of the workspace (e.g., "Lensvox").',
        )
        parser.add_argument(
            "--description",
            type=str,
            default="",
            help="Optional description for the workspace.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what will happen without making any changes.",
        )
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            help="Skip silently if a default workspace already exists for this org.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.organizations.models import Organization, Workspace, WorkspaceMembership

        User = get_user_model()

        org_id = options["org_id"]
        ws_name = options["name"]
        ws_description = options["description"]
        dry_run = options["dry_run"]
        skip_existing = options["skip_existing"]

        # ── 1. Find the organization ──
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            raise CommandError(f"Organization with ID {org_id} does not exist.")

        self.stdout.write(f"\nOrganization: {org.name} (ID: {org.id})")
        self.stdout.write(f"Workspace name: {ws_name}")

        # ── 2. Check if default workspace already exists ──
        existing_default = Workspace.objects.filter(
            organization=org, is_default=True
        ).first()

        if existing_default:
            if skip_existing:
                self.stdout.write(
                    self.style.WARNING(
                        f"\nDefault workspace already exists: '{existing_default.name}' "
                        f"(ID: {existing_default.id}). Skipping."
                    )
                )
                return
            else:
                raise CommandError(
                    f"A default workspace already exists for this org: "
                    f"'{existing_default.name}' (ID: {existing_default.id}). "
                    f"Use --skip-existing to ignore, or delete it manually first."
                )

        # ── 3. Find all users in this org ──
        users = User.objects.filter(organization=org)
        user_count = users.count()
        self.stdout.write(f"Users in org: {user_count}")

        if dry_run:
            self.stdout.write(self.style.WARNING("\n── DRY RUN (no changes made) ──\n"))

        # Show user breakdown
        admin_users = []
        member_users = []
        for user in users:
            if getattr(user, "role", "") in ("admin", "manager"):
                admin_users.append(user)
            else:
                member_users.append(user)

        self.stdout.write(f"  → Will be added as workspace ADMIN: {len(admin_users)}")
        for u in admin_users:
            self.stdout.write(f"      {u.username} ({u.email}) - role: {u.role}")

        self.stdout.write(f"  → Will be added as workspace MEMBER: {len(member_users)}")
        for u in member_users:
            self.stdout.write(f"      {u.username} ({u.email}) - role: {getattr(u, 'role', 'N/A')}")

        # ── 4. Count tenant records that will be backfilled ──
        from django.apps import apps as django_apps
        from apps.organizations.models import TenantModel

        backfill_models = []
        for model in django_apps.get_models():
            if (
                issubclass(model, TenantModel)
                and not model._meta.abstract
                and model is not TenantModel
            ):
                count = model.original_objects.filter(
                    organization=org, workspace__isnull=True
                ).count()
                if count > 0:
                    label = f"{model._meta.app_label}.{model.__name__}"
                    backfill_models.append((model, label, count))

        if backfill_models:
            self.stdout.write(f"\nRecords to backfill (workspace_id = NULL → new workspace):")
            for model, label, count in backfill_models:
                self.stdout.write(f"  → {label}: {count} records")
        else:
            self.stdout.write("\nNo existing records need backfilling.")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDry run complete. Run without --dry-run to apply changes.")
            )
            return

        # ── 5. Create the workspace ──
        workspace = Workspace.objects.create(
            organization=org,
            name=ws_name,
            description=ws_description,
            is_default=True,
            is_active=True,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"\nWorkspace created: '{workspace.name}' (ID: {workspace.id}, slug: {workspace.slug})"
            )
        )

        # ── 6. Add all users as members ──
        memberships = []
        for user in admin_users:
            memberships.append(
                WorkspaceMembership(user=user, workspace=workspace, role="admin")
            )
        for user in member_users:
            memberships.append(
                WorkspaceMembership(user=user, workspace=workspace, role="member")
            )

        if memberships:
            WorkspaceMembership.objects.bulk_create(memberships)
            self.stdout.write(
                self.style.SUCCESS(f"Added {len(memberships)} members to workspace.")
            )

        # ── 7. Backfill workspace_id on existing records ──
        total_backfilled = 0
        for model, label, count in backfill_models:
            updated = model.original_objects.filter(
                organization=org, workspace__isnull=True
            ).update(workspace=workspace)
            total_backfilled += updated
            self.stdout.write(f"  Backfilled {label}: {updated} records")

        if total_backfilled:
            self.stdout.write(
                self.style.SUCCESS(f"Total records backfilled: {total_backfilled}")
            )

        # ── Summary ──
        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Done! Workspace '{ws_name}' is ready for org '{org.name}'.\n"
                f"   Workspace ID: {workspace.id}\n"
                f"   Members: {len(memberships)}\n"
                f"   Backfilled records: {total_backfilled}\n"
            )
        )