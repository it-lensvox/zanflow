"""
Management command to backfill the system "Tasks" folder for all existing
projects that were created before the auto-folder signal was added.

Usage:
    python manage.py backfill_tasks_folders
    python manage.py backfill_tasks_folders --dry-run   # preview only, no DB writes

Place this file at:
    apps/ground_truth/management/commands/backfill_tasks_folders.py

Also make sure the following __init__.py files exist (create them if missing):
    apps/ground_truth/management/__init__.py
    apps/ground_truth/management/commands/__init__.py
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.projects.models import Project
from apps.groundtruth.models import Folder   # adjust import path if needed


class Command(BaseCommand):
    help = "Backfill the system 'Tasks' folder for all projects that are missing one."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview which projects would be affected without writing anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no changes will be saved.\n"))

        # Find all projects that don't yet have a system-generated Tasks folder.
        # Uses exclude() + subquery instead of Python filtering — runs in one DB query.
        projects_with_folder = Folder.objects.filter(
            name="Tasks",
            is_system_generated=True,
        ).values_list("project_id", flat=True)

        projects_missing_folder = Project.objects.exclude(
            id__in=projects_with_folder
        ).select_related("created_by")

        total = projects_missing_folder.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS("All projects already have a Tasks folder. Nothing to do."))
            return

        self.stdout.write(f"Found {total} project(s) missing a Tasks folder.\n")

        created_count = 0
        skipped_count = 0
        error_count = 0

        for project in projects_missing_folder.iterator():
            # Mirror the exact same logic used in signals.py
            org_id = (
                getattr(project, "organization_id", None)
                or getattr(project.created_by, "organization_id", None)
            )

            self.stdout.write(f"  Project: '{project.name}' (id={project.id}, org={org_id})")

            if dry_run:
                self.stdout.write(self.style.WARNING("    → would create Tasks folder [DRY RUN]"))
                created_count += 1
                continue

            try:
                with transaction.atomic():
                    folder, was_created = Folder.objects.get_or_create(
                        project=project,
                        name="Tasks",
                        is_system_generated=True,
                        defaults={
                            "created_by": project.created_by,
                            "organization_id": org_id,
                        },
                    )

                if was_created:
                    self.stdout.write(self.style.SUCCESS(f"    → Tasks folder created (folder id={folder.id})"))
                    created_count += 1
                else:
                    # This shouldn't happen given our queryset filter, but handle it safely
                    self.stdout.write(self.style.WARNING(f"    → Tasks folder already existed (folder id={folder.id}), skipped"))
                    skipped_count += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"    → ERROR: {e}"))
                error_count += 1

        # Summary
        self.stdout.write("\n--- Summary ---")
        if dry_run:
            self.stdout.write(self.style.WARNING(f"  Would create: {created_count} folder(s) [DRY RUN, nothing saved]"))
        else:
            self.stdout.write(self.style.SUCCESS(f"  Created:  {created_count} folder(s)"))
            self.stdout.write(f"  Skipped:  {skipped_count} (already existed)")
            if error_count:
                self.stdout.write(self.style.ERROR(f"  Errors:   {error_count} (check logs above)"))
            else:
                self.stdout.write(self.style.SUCCESS("  Errors:   0"))