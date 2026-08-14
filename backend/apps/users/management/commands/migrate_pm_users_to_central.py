"""
apps/users/management/commands/migrate_pm_users_to_central.py

ONE-TIME migration command: reads all existing users from PM database
and creates corresponding accounts in Central database.

WHY THIS EXISTS:
    Before Central existed, all users (signup/login) were stored in PM DB.
    Central is now the single identity provider.
    This command migrates all old PM users to Central so they can log in
    via Central going forward.

WHAT IT DOES:
    1. Reads every user from PM DB (via DATABASE_ROUTER or direct connection)
    2. For each PM user:
       - Creates an Organization in Central DB (if not exists) matching PM org
       - Creates a User in Central DB (if not exists, matched by email)
       - Sets a usable password only if the user has a valid hash in PM DB
       - Records the mapping: pm_user_id → central_user_id
    3. Saves the mapping to: pm_user_id_map.json
       This file is used by PM's apply_central_user_ids command.

SAFE TO RE-RUN:
    Uses get_or_create throughout — never duplicates.
    If a Central user already exists with the same email → skips creation,
    just records the mapping.

AFTER RUNNING:
    1. Copy pm_user_id_map.json to PM backend
    2. Run: python manage.py apply_central_user_ids
    3. Update WorkspaceJWTAuthentication to use central_user_id

USAGE:
    # Preview without making changes
    python manage.py migrate_pm_users_to_central --dry-run

    # Full migration (connect to PM DB first — see below)
    python manage.py migrate_pm_users_to_central

HOW TO CONNECT TO PM DB:
    Add PM database to Central settings.py temporarily:

    DATABASES = {
        "default": { ... Central DB ... },
        "pm": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": "/Users/Harshitshukla/Desktop/ZanFlow/ZanFlow/backend/db.sqlite3",
        }
    }

    Then run:
    python manage.py migrate_pm_users_to_central --pm-db pm
"""

import json
import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

OUTPUT_FILE = "pm_user_id_map.json"


class Command(BaseCommand):
    help = (
        "ONE-TIME: Migrate all PM DB users to Central DB. "
        "Run once per environment. Safe to re-run."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what would be migrated without making changes.",
        )
        parser.add_argument(
            "--pm-db",
            type=str,
            default="pm",
            help="Database alias for PM DB in DATABASES settings (default: 'pm').",
        )
        parser.add_argument(
            "--output",
            type=str,
            default=OUTPUT_FILE,
            help=f"Output file for id mapping (default: {OUTPUT_FILE}).",
        )

    def handle(self, *args, **options):
        from django.db import connections, OperationalError

        dry_run = options["dry_run"]
        pm_db   = options["pm_db"]
        output  = options["output"]

        if dry_run:
            self.stdout.write(self.style.WARNING(
                "\nDRY RUN — no changes will be made.\n"
            ))

        # ── Validate PM DB connection ──────────────────────────────────────
        try:
            conn = connections[pm_db]
            conn.ensure_connection()
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"\nCannot connect to PM database '{pm_db}'.\n"
                f"Add it to Central settings.py DATABASES first.\n\n"
                f"  DATABASES = {{\n"
                f"    'default': {{ ... Central DB ... }},\n"
                f"    'pm': {{\n"
                f"      'ENGINE': 'django.db.backends.sqlite3',\n"
                f"      'NAME': '/path/to/pm/db.sqlite3',\n"
                f"    }}\n"
                f"  }}\n\n"
                f"Error: {e}\n"
            ))
            return

        # ── Read PM users directly via raw SQL ─────────────────────────────
        # We use raw SQL so we do not need PM's User model in Central.
        self.stdout.write("── Reading users from PM database ──────────────────")

        with connections[pm_db].cursor() as cursor:
            # Read users table from PM
            cursor.execute("""
                SELECT
                    u.id,
                    u.username,
                    u.email,
                    u.password,
                    u.first_name,
                    u.last_name,
                    u.is_active,
                    u.is_staff,
                    u.is_superuser,
                    u.date_joined,
                    u.organization_id,
                    COALESCE(o.name, '') as org_name,
                    COALESCE(o.slug, '') as org_slug
                FROM users u
                LEFT JOIN organizations_organization o
                       ON o.id = u.organization_id
                ORDER BY u.id
            """)
            columns  = [col[0] for col in cursor.description]
            pm_users = [dict(zip(columns, row)) for row in cursor.fetchall()]

        self.stdout.write(f"  Found {len(pm_users)} users in PM DB.\n")

        # ── Migrate each user ──────────────────────────────────────────────
        self.stdout.write("── Migrating to Central DB ─────────────────────────")

        id_map        = {}   # {pm_user_id: central_user_id}
        created_count = 0
        skipped_count = 0
        error_count   = 0

        from apps.organizations.models import Organization, Platform, PlatformAccess

        for pm_user in pm_users:
            pm_id = pm_user["id"]
            email = (pm_user["email"] or "").strip().lower()

            if not email:
                self.stdout.write(
                    self.style.WARNING(f"  SKIP id={pm_id} — no email")
                )
                skipped_count += 1
                continue

            # Skip superusers — they are platform-level accounts
            if pm_user["is_superuser"]:
                self.stdout.write(
                    f"  SKIP id={pm_id} {email} — superuser (keep in PM only)"
                )
                skipped_count += 1
                continue

            try:
                # ── Ensure org exists in Central DB ────────────────────────
                central_org = None
                pm_org_id   = pm_user["organization_id"]
                pm_org_name = pm_user["org_name"]
                pm_org_slug = pm_user["org_slug"]

                if pm_org_id and pm_org_name:
                    if not dry_run:
                        central_org, org_created = Organization.objects.get_or_create(
                            id       = pm_org_id,
                            defaults = {
                                "name":      pm_org_name,
                                "slug":      pm_org_slug or f"org-{pm_org_id}",
                                "is_active": True,
                            },
                        )
                        # Grant PM platform access to this org
                        try:
                            pm_platform = Platform.objects.filter(
                                key="pm", is_active=True
                            ).first()
                            if pm_platform:
                                PlatformAccess.objects.get_or_create(
                                    organization=central_org,
                                    platform=pm_platform,
                                    defaults={"is_active": True},
                                )
                        except Exception:
                            pass

                # ── Create or get Central user ─────────────────────────────
                existing = User.objects.filter(email__iexact=email).first()

                if existing:
                    # User already in Central — just record the mapping
                    id_map[str(pm_id)] = existing.id
                    self.stdout.write(
                        f"  EXISTS  id={pm_id} → central_id={existing.id}  {email}"
                    )
                    skipped_count += 1
                else:
                    if dry_run:
                        self.stdout.write(
                            f"  WOULD CREATE  pm_id={pm_id}  {email}  "
                            f"org={pm_org_name or 'none'}"
                        )
                        created_count += 1
                        id_map[str(pm_id)] = f"(new — dry run)"
                        continue

                    # Create Central user
                    # Use same username if possible, fallback to email prefix
                    username    = pm_user["username"] or email.split("@")[0]
                    safe_user   = username
                    counter     = 1
                    while User.objects.filter(username=safe_user).exists():
                        safe_user = f"{username}_{counter}"
                        counter  += 1

                    central_user = User(
                        username   = safe_user,
                        email      = email,
                        first_name = pm_user["first_name"] or "",
                        last_name  = pm_user["last_name"]  or "",
                        is_active  = bool(pm_user["is_active"]),
                        is_staff   = False,
                        is_superuser = False,
                        organization = central_org,
                    )

                    # Copy password hash directly — same Django format
                    # User can log in with their existing password
                    if pm_user["password"] and pm_user["password"] != "":
                        central_user.password = pm_user["password"]
                    else:
                        central_user.set_unusable_password()

                    central_user.save()
                    created_count      += 1
                    id_map[str(pm_id)]  = central_user.id

                    self.stdout.write(self.style.SUCCESS(
                        f"  CREATED pm_id={pm_id} → central_id={central_user.id}  {email}"
                    ))

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"  ERROR   pm_id={pm_id} {email}: {e}"
                ))
                error_count += 1

        # ── Save mapping file ──────────────────────────────────────────────
        if not dry_run:
            with open(output, "w") as f:
                json.dump(id_map, f, indent=2)
            self.stdout.write(self.style.SUCCESS(
                f"\n  Mapping saved to: {output}"
            ))

        action = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"\n{'DRY RUN ' if dry_run else ''}Done.\n"
            f"  {action}  : {created_count} Central user(s)\n"
            f"  Skipped  : {skipped_count} (already existed or superuser)\n"
            f"  Errors   : {error_count}\n"
            f"  Mapped   : {len(id_map)} total\n"
        ))

        if not dry_run and not error_count:
            self.stdout.write(
                f"\nNext steps:\n"
                f"  1. Copy {output} to PM backend root\n"
                f"  2. Run in PM: python manage.py apply_central_user_ids\n"
            )
