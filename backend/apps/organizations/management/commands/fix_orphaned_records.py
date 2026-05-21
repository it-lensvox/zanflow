"""
Management command: Fix orphaned records that have no organization or workspace.

This handles records created before the multi-tenant/workspace system was added.
Safe to run multiple times (idempotent) — only updates records that need fixing.

Usage:
    # Preview what will be fixed (no changes)
    python manage.py fix_orphaned_records --dry-run

    # Fix all orphaned records, assign to org 1 and workspace 1
    python manage.py fix_orphaned_records --org-id 1 --workspace-id 1

    # Fix and assign to a specific org/workspace
    python manage.py fix_orphaned_records --org-id 2 --workspace-id 5
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.apps import apps


class Command(BaseCommand):
    help = "Fix orphaned records that have no organization or workspace assigned."

    def add_arguments(self, parser):
        parser.add_argument(
            "--org-id",
            type=int,
            default=1,
            help="Organization ID to assign orphaned records to (default: 1).",
        )
        parser.add_argument(
            "--workspace-id",
            type=int,
            default=None,
            help="Workspace ID to assign orphaned records to. If not provided, uses the default workspace of the org.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what will be fixed without making changes.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.organizations.models import Organization, Workspace, TenantModel

        org_id = options["org_id"]
        workspace_id = options["workspace_id"]
        dry_run = options["dry_run"]

        # ── 1. Validate organization ──
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            raise CommandError(f"Organization with ID {org_id} does not exist.")

        # ── 2. Resolve workspace ──
        if workspace_id:
            try:
                workspace = Workspace.objects.get(id=workspace_id, organization=org)
            except Workspace.DoesNotExist:
                raise CommandError(
                    f"Workspace with ID {workspace_id} does not exist in org '{org.name}'."
                )
        else:
            workspace = Workspace.objects.filter(organization=org, is_default=True).first()
            if not workspace:
                raise CommandError(
                    f"No default workspace found for org '{org.name}'. "
                    f"Run create_default_workspace first, or pass --workspace-id explicitly."
                )

        self.stdout.write(f"\nOrganization: {org.name} (ID: {org.id})")
        self.stdout.write(f"Workspace: {workspace.name} (ID: {workspace.id})")

        if dry_run:
            self.stdout.write(self.style.WARNING("\n── DRY RUN (no changes) ──\n"))

        # ── 3. Find all TenantModel subclasses ──
        tenant_models = []
        for model in apps.get_models():
            if (
                issubclass(model, TenantModel)
                and not model._meta.abstract
                and model is not TenantModel
            ):
                tenant_models.append(model)

        total_fixed = 0

        for model in tenant_models:
            label = f"{model._meta.app_label}.{model.__name__}"

            # Case 1: No organization AND no workspace
            no_org_count = model.original_objects.filter(
                organization_id__isnull=True
            ).count()

            # Case 2: Has organization but no workspace
            no_ws_count = model.original_objects.filter(
                organization_id__isnull=False,
                workspace_id__isnull=True,
            ).count()

            if no_org_count == 0 and no_ws_count == 0:
                continue

            if no_org_count > 0:
                self.stdout.write(
                    f"  {label}: {no_org_count} records with no org → "
                    f"assigning to org={org.id}, workspace={workspace.id}"
                )
                if not dry_run:
                    model.original_objects.filter(
                        organization_id__isnull=True
                    ).update(organization_id=org.id, workspace_id=workspace.id)

            if no_ws_count > 0:
                self.stdout.write(
                    f"  {label}: {no_ws_count} records with org but no workspace → "
                    f"assigning workspace={workspace.id}"
                )
                if not dry_run:
                    model.original_objects.filter(
                        organization_id__isnull=False,
                        workspace_id__isnull=True,
                    ).update(workspace_id=workspace.id)

            total_fixed += no_org_count + no_ws_count

        # ── 4. Summary ──
        if total_fixed == 0:
            self.stdout.write(self.style.SUCCESS("\nNo orphaned records found. Everything is clean!"))
        elif dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"\n{total_fixed} records would be fixed. Run without --dry-run to apply."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"\n✅ Fixed {total_fixed} orphaned records.")
            )