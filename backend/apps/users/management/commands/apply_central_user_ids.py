"""
apps/users/management/commands/apply_central_user_ids.py

ONE-TIME: Read pm_user_id_map.json (produced by Central's
migrate_pm_users_to_central command) and update every PM user's
central_user_id field.

USAGE:
    python manage.py apply_central_user_ids
    python manage.py apply_central_user_ids --file /path/to/pm_user_id_map.json
    python manage.py apply_central_user_ids --dry-run
"""

import json
import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = (
        "ONE-TIME: Apply central_user_id values to existing PM users "
        "from pm_user_id_map.json produced by Central's migration command."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default="pm_user_id_map.json",
            help="Path to pm_user_id_map.json (default: ./pm_user_id_map.json)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview without making any changes.",
        )

    def handle(self, *args, **options):
        map_file = options["file"]
        dry_run  = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING(
                "\nDRY RUN — no changes will be made.\n"
            ))

        # ── Load mapping file ──────────────────────────────────────────────
        if not os.path.exists(map_file):
            self.stdout.write(self.style.ERROR(
                f"\nFile not found: {map_file}\n"
                f"Run this in Central first:\n"
                f"  python manage.py migrate_pm_users_to_central\n"
                f"Then copy pm_user_id_map.json to PM backend root.\n"
            ))
            return

        with open(map_file) as f:
            id_map = json.load(f)

        self.stdout.write(
            f"Loaded {len(id_map)} mappings from {map_file}.\n"
        )
        self.stdout.write("── Applying central_user_id values ────────────────")

        updated_count = 0
        skipped_count = 0
        not_found     = 0
        error_count   = 0

        for pm_id_str, central_id in id_map.items():
            pm_id = int(pm_id_str)

            # Skip dry-run placeholder values
            if not isinstance(central_id, int):
                skipped_count += 1
                continue

            try:
                user = User.objects.filter(id=pm_id).first()

                if not user:
                    self.stdout.write(
                        f"  NOT FOUND  pm_id={pm_id} → central_id={central_id}"
                    )
                    not_found += 1
                    continue

                if user.central_user_id == central_id:
                    skipped_count += 1
                    continue

                if dry_run:
                    self.stdout.write(
                        f"  WOULD SET  pm_id={pm_id} ({user.email}) "
                        f"→ central_user_id={central_id}"
                    )
                    updated_count += 1
                    continue

                # Check if another PM user already has this central_user_id
                # (happens when same email exists twice in PM DB)
                already_claimed = User.objects.filter(
                    central_user_id=central_id
                ).exclude(id=pm_id).first()

                if already_claimed:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  SKIP  pm_id={pm_id} ({user.email}) "
                            f"→ central_user_id={central_id} "
                            f"already claimed by pm_id={already_claimed.id} "
                            f"({already_claimed.email}) — duplicate email in PM"
                        )
                    )
                    skipped_count += 1
                    continue

                user.central_user_id = central_id
                user.save(update_fields=["central_user_id"])
                updated_count += 1
                self.stdout.write(
                    f"  SET  pm_id={pm_id} ({user.email}) → central_user_id={central_id}"
                )

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"  ERROR  pm_id={pm_id}: {e}"
                ))
                error_count += 1

        action = "Would update" if dry_run else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"\n{'DRY RUN ' if dry_run else ''}Done.\n"
            f"  {action}   : {updated_count} user(s)\n"
            f"  Skipped    : {skipped_count} (already set or dry-run placeholder)\n"
            f"  Not found  : {not_found} (PM user deleted — ok to ignore)\n"
            f"  Errors     : {error_count}\n"
        ))

        if not dry_run and not error_count:
            self.stdout.write(
                "\nNext steps:\n"
                "  WorkspaceJWTAuthentication and WebSocket middleware\n"
                "  now resolve users via central_user_id.\n"
                "  Restart PM backend: daphne -b 0.0.0.0 -p 8000 config.asgi:application\n"
            )