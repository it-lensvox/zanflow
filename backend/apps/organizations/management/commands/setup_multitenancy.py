"""
Management command: setup_multitenancy

Creates the default organization and assigns all existing unassigned
database records to "Production Team" (ID: 1).

Usage:
    python manage.py setup_multitenancy
    python manage.py setup_multitenancy --dry-run   # preview without saving
"""

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.organizations.models import Organization, TenantModel


class Command(BaseCommand):
    help = "Create default organization and assign existing records to Production Team."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without making changes.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("=== DRY RUN MODE ===\n"))

        # -----------------------------------------------------------------
        # Step 1: Create default organization
        # -----------------------------------------------------------------
        self.stdout.write(self.style.MIGRATE_HEADING("Step 1: Creating organization"))

        org, created = Organization.objects.get_or_create(
            id=1,
            defaults={
                "name": "Production Team",
                "slug": "production-team",
            },
        )
        status = "CREATED" if created else "EXISTS"
        self.stdout.write(f"  [{status}] {org.name} (ID: {org.id})")

        # -----------------------------------------------------------------
        # Step 2: Assign all existing records to Production Team (ID: 1)
        # -----------------------------------------------------------------
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "\nStep 2: Assigning unassigned records to Production Team"
            )
        )

        production_org = Organization.objects.get(id=1)

        # Find all concrete models that inherit from TenantModel
        tenant_models = []
        for model in apps.get_models():
            if (
                issubclass(model, TenantModel)
                and not model._meta.abstract
                and model is not TenantModel
            ):
                tenant_models.append(model)

        # Also handle User model separately (it has organization FK but
        # doesn't inherit TenantModel)
        from django.contrib.auth import get_user_model
        User = get_user_model()

        if hasattr(User, "organization_id"):
            unassigned_users = User.objects.filter(organization__isnull=True).count()
            self.stdout.write(
                f"  User: {unassigned_users} unassigned record(s)"
            )
            if not dry_run and unassigned_users > 0:
                updated = User.objects.filter(organization__isnull=True).update(
                    organization=production_org
                )
                self.stdout.write(
                    self.style.SUCCESS(f"    → Updated {updated} user(s)")
                )

        # Process all TenantModel subclasses
        for model in tenant_models:
            model_label = f"{model._meta.app_label}.{model.__name__}"
            # Use original_objects (unfiltered) to access ALL records
            unassigned = model.original_objects.filter(
                organization__isnull=True
            ).count()
            self.stdout.write(f"  {model_label}: {unassigned} unassigned record(s)")

            if not dry_run and unassigned > 0:
                updated = model.original_objects.filter(
                    organization__isnull=True
                ).update(organization=production_org)
                self.stdout.write(
                    self.style.SUCCESS(f"    → Updated {updated} record(s)")
                )

        # -----------------------------------------------------------------
        # Done
        # -----------------------------------------------------------------
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\n=== DRY RUN COMPLETE — no changes were made ==="
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("\n✓ Multi-tenancy setup complete!")
            )