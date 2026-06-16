"""
Management command: Backfill quicknotes (Folder, Note) with correct
organization and workspace based on the user who created them.

This is DIFFERENT from fix_orphaned_records which assigns everything
to one specific org. This command looks at each note's creator and
assigns it to THAT user's organization and default workspace.

Usage:
    # Preview
    python manage.py backfill_quicknotes --dry-run

    # Run it
    python manage.py backfill_quicknotes
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand):
    help = "Backfill quicknotes Folder and Note with organization and workspace based on creator."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview without making any changes.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.quicknotes.models import Folder, Note
        from apps.organizations.models import Workspace

        User = get_user_model()
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("\n── DRY RUN (no changes) ──\n"))

        # ── 1. Backfill Folders ──────────────────────────────────────────
        folders = Folder.original_objects.filter(organization_id__isnull=True)
        self.stdout.write(f"\nFolders to backfill: {folders.count()}")

        folder_fixed = 0
        folder_skipped = 0

        for folder in folders:
            user = folder.user
            if not user or not user.organization_id:
                self.stdout.write(
                    f"  ⚠  Folder '{folder.name}' (ID:{folder.id}) — user has no org, skipping"
                )
                folder_skipped += 1
                continue

            # Get default workspace for this user's org
            workspace = Workspace.objects.filter(
                organization_id=user.organization_id,
                is_default=True,
            ).first()

            if not workspace:
                self.stdout.write(
                    f"  ⚠  Folder '{folder.name}' — org {user.organization_id} has no default workspace, skipping"
                )
                folder_skipped += 1
                continue

            self.stdout.write(
                f"  → Folder '{folder.name}' (user: {user.username}) "
                f"→ org: {user.organization.name}, workspace: {workspace.name}"
            )

            if not dry_run:
                Folder.original_objects.filter(id=folder.id).update(
                    organization_id=user.organization_id,
                    workspace_id=workspace.id,
                )
                folder_fixed += 1

        # ── 2. Backfill Notes ────────────────────────────────────────────
        notes = Note.original_objects.filter(organization_id__isnull=True)
        self.stdout.write(f"\nNotes to backfill: {notes.count()}")

        note_fixed = 0
        note_skipped = 0

        for note in notes:
            user = note.user
            if not user or not user.organization_id:
                self.stdout.write(
                    f"  ⚠  Note '{note.title or 'Untitled'}' (ID:{note.id}) — user has no org, skipping"
                )
                note_skipped += 1
                continue

            # Get default workspace for this user's org
            workspace = Workspace.objects.filter(
                organization_id=user.organization_id,
                is_default=True,
            ).first()

            if not workspace:
                self.stdout.write(
                    f"  ⚠  Note '{note.title or 'Untitled'}' — org {user.organization_id} has no default workspace, skipping"
                )
                note_skipped += 1
                continue

            self.stdout.write(
                f"  → Note '{note.title or 'Untitled'}' (user: {user.username}) "
                f"→ org: {user.organization.name}, workspace: {workspace.name}"
            )

            if not dry_run:
                Note.original_objects.filter(id=note.id).update(
                    organization_id=user.organization_id,
                    workspace_id=workspace.id,
                )
                note_fixed += 1

        # ── Summary ──────────────────────────────────────────────────────
        self.stdout.write(f"\n{'═' * 50}")
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "Dry run complete. Run without --dry-run to apply."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✅ Done!\n"
                    f"   Folders fixed  : {folder_fixed}\n"
                    f"   Notes fixed    : {note_fixed}\n"
                    f"   Skipped        : {folder_skipped + note_skipped}\n"
                )
            )