"""
Management command: Setup workspaces for ALL organizations.

This is the ONE command to run on production deployment after the workspace
feature is released. It handles everything automatically:
  1. Creates a default workspace for every org that doesn't have one.
  2. Adds all users of each org as workspace members.
  3. Backfills workspace_id on all existing data (projects, tasks, chat, etc.)

Safe to run multiple times (idempotent) — skips orgs that already have workspaces.

Usage:
    # Preview what will happen (no changes)
    python manage.py setup_all_workspaces --dry-run

    # Run it
    python manage.py setup_all_workspaces

    # Skip specific orgs by ID (e.g. test/dummy orgs)
    python manage.py setup_all_workspaces --skip-orgs 20 21 22
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.apps import apps


class Command(BaseCommand):
    help = "Setup default workspaces for all organizations and restore all existing data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what will happen without making any changes.",
        )
        parser.add_argument(
            "--skip-orgs",
            nargs="+",
            type=int,
            default=[],
            help="List of org IDs to skip (e.g. test/dummy orgs). Example: --skip-orgs 20 21 22",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.organizations.models import Organization, Workspace, WorkspaceMembership, TenantModel

        User = get_user_model()
        dry_run = options["dry_run"]
        skip_orgs = options["skip_orgs"]

        if dry_run:
            self.stdout.write(self.style.WARNING("\n── DRY RUN (no changes will be made) ──\n"))

        if skip_orgs:
            self.stdout.write(f"Skipping org IDs: {skip_orgs}\n")

        orgs = Organization.objects.all().order_by("id")
        total_workspaces_created = 0
        total_members_added = 0
        total_records_backfilled = 0

        for org in orgs:
            # Skip if requested
            if org.id in skip_orgs:
                self.stdout.write(f"\n⏭  Skipping: {org.name} (ID: {org.id})")
                continue

            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write(f"📁 Org: {org.name} (ID: {org.id})")

            # ── STEP 1: Create default workspace if missing ──────────────────
            existing_default = Workspace.objects.filter(
                organization=org, is_default=True
            ).first()

            if existing_default:
                self.stdout.write(
                    f"   ✅ Default workspace already exists: '{existing_default.name}' (ID: {existing_default.id})"
                )
                workspace = existing_default
            else:
                users = User.objects.filter(organization=org)
                user_count = users.count()

                self.stdout.write(
                    f"   → Will create workspace '{org.name}' with {user_count} member(s)"
                )

                if not dry_run:
                    workspace = Workspace.objects.create(
                        organization=org,
                        name=org.name,
                        is_default=True,
                        is_active=True,
                    )
                    total_workspaces_created += 1

                    # ── STEP 2: Add all users as members ──
                    members_added = 0
                    for user in users:
                        role = "admin" if user.role in ("admin", "manager") else "member"
                        _, created = WorkspaceMembership.objects.get_or_create(
                            user=user,
                            workspace=workspace,
                            defaults={"role": role},
                        )
                        if created:
                            members_added += 1

                    total_members_added += members_added
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"   ✅ Created workspace '{workspace.name}' — {members_added} member(s) added"
                        )
                    )
                else:
                    workspace = None

            # ── STEP 3: Backfill workspace_id on existing data ───────────────
            if workspace or dry_run:
                org_total = 0
                models_with_data = []

                for model in apps.get_models():
                    if (
                        issubclass(model, TenantModel)
                        and not model._meta.abstract
                        and model is not TenantModel
                    ):
                        # Records with no org AND no workspace
                        no_org_count = model.original_objects.filter(
                            organization_id__isnull=True,
                        ).count()

                        # Records with this org but no workspace
                        no_ws_count = model.original_objects.filter(
                            organization_id=org.id,
                            workspace_id__isnull=True,
                        ).count()

                        total = no_org_count + no_ws_count
                        if total > 0:
                            label = f"{model._meta.app_label}.{model.__name__}"
                            models_with_data.append((model, label, no_org_count, no_ws_count))
                            org_total += total

                if org_total == 0:
                    self.stdout.write("   ✅ No orphaned records — all data already linked")
                else:
                    self.stdout.write(f"   → {org_total} record(s) to backfill:")
                    for model, label, no_org, no_ws in models_with_data:
                        self.stdout.write(f"      {label}: {no_org + no_ws} records")

                    if not dry_run and workspace:
                        for model, label, no_org, no_ws in models_with_data:
                            if no_org > 0:
                                model.original_objects.filter(
                                    organization_id__isnull=True,
                                ).update(
                                    organization_id=org.id,
                                    workspace_id=workspace.id,
                                )
                            if no_ws > 0:
                                model.original_objects.filter(
                                    organization_id=org.id,
                                    workspace_id__isnull=True,
                                ).update(workspace_id=workspace.id)

                        total_records_backfilled += org_total
                        self.stdout.write(
                            self.style.SUCCESS(f"   ✅ Backfilled {org_total} records")
                        )

        # ── SUMMARY ─────────────────────────────────────────────────────────
        self.stdout.write(f"\n{'═' * 50}")
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN complete. Run without --dry-run to apply changes."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✅ Setup complete!\n"
                    f"   Workspaces created : {total_workspaces_created}\n"
                    f"   Members added      : {total_members_added}\n"
                    f"   Records backfilled : {total_records_backfilled}\n"
                )
            )