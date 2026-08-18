"""
apps/rbac/management/commands/setup_hrms.py

Sets up HRMS roles for one or all organisations.

NO HARDCODED EMAILS OR ORG IDs.

Auto-detects the founder per organisation — the first admin user
(lowest primary key with role='admin') is treated as the founder
and assigned owner + org_admin + hr_admin.

All other users in the same org get employee role in HRMS.

Works for any database — local, staging, production.

Usage:
    # Setup ALL organisations
    python manage.py setup_hrms

    # Setup one specific org only
    python manage.py setup_hrms --org-id 5

    # Dry run first always
    python manage.py setup_hrms --dry-run
    python manage.py setup_hrms --org-id 5 --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q


class Command(BaseCommand):
    help = "Setup HRMS roles for all organisations. No hardcoded emails or org IDs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without writing anything.",
        )
        parser.add_argument(
            "--org-id",
            type=int,
            default=None,
            help="Only setup HRMS for this specific organisation ID.",
        )

    def handle(self, *args, **options):
        from apps.rbac.models import Role, RoleAssignment
        from django.contrib.auth import get_user_model
        User = get_user_model()

        dry_run = options["dry_run"]
        org_id  = options["org_id"]
        today   = timezone.now().date()

        if dry_run:
            self.stdout.write(self.style.WARNING(
                "DRY RUN — no changes will be made.\n"
            ))

        # ── Load roles upfront ─────────────────────────────────────────
        roles = self._load_roles()
        if not roles:
            return

        # ── Find all organisations to process ──────────────────────────
        from apps.organizations.models import Organization
        orgs = Organization.objects.filter(is_active=True)
        if org_id:
            orgs = orgs.filter(id=org_id)

        if not orgs.exists():
            self.stdout.write(self.style.ERROR(
                f"No active organisations found"
                f"{f' with id={org_id}' if org_id else ''}.\n"
            ))
            return

        self.stdout.write(f"Processing {orgs.count()} organisation(s).\n")

        total_founder    = 0
        total_employee   = 0
        total_skipped    = 0
        total_no_founder = 0

        for org in orgs:
            self.stdout.write(
                f"\n── Organisation: {org.name} (id={org.id}) ──────────────"
            )

            # ── Auto-detect founder for this org ───────────────────────
            # Founder = first admin user by lowest primary key
            # This is the person who signed up and created the org
            founder = User.objects.filter(
                organization_id = org.id,
                role            = "admin",
                is_active       = True,
            ).order_by("id").first()

            if not founder:
                self.stdout.write(
                    self.style.WARNING(
                        f"  No admin user found for {org.name} — skipping."
                    )
                )
                total_no_founder += 1
                continue

            self.stdout.write(
                f"  Founder detected : {founder.email} (id={founder.pk})\n"
            )

            # ── Step 1: Assign founder roles ───────────────────────────
            founder_assignments = [
                (roles["owner"],     "pm",   "organization", org.id, "owner"),
                (roles["org_admin"], "pm",   "organization", org.id, "org_admin"),
                (roles["hr_admin"],  "hrms", "organization", org.id, "hr_admin"),
            ]

            for role, platform, scope_type, scope_id, label in founder_assignments:
                result = self._create_assignment(
                    dry_run, founder, role,
                    platform, scope_type, scope_id, today,
                )
                if result == "created":
                    total_founder += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  ✓ Created  : {label} [{platform}] → {founder.email}"
                        )
                    )
                elif result == "exists":
                    total_skipped += 1
                    self.stdout.write(
                        f"  = Exists   : {label} [{platform}] → {founder.email}"
                    )
                else:
                    total_founder += 1

            # ── Step 2: Assign employee to all other users in this org ──
            other_users = User.objects.filter(
                organization_id = org.id,
                is_active       = True,
            ).exclude(
                pk           = founder.pk,
            ).exclude(
                is_superuser = True,
            )

            self.stdout.write(
                f"\n  Assigning employee role to {other_users.count()} other users...\n"
            )

            for user in other_users.order_by("id"):
                result = self._create_assignment(
                    dry_run, user, roles["employee"],
                    "hrms", "organization", org.id, today,
                )
                if result == "created":
                    total_employee += 1
                    self.stdout.write(
                        f"  ✓ employee [hrms] → {user.email}"
                    )
                elif result == "exists":
                    total_skipped += 1
                    self.stdout.write(
                        f"  = exists   [hrms] → {user.email}"
                    )
                else:
                    total_employee += 1

        # ── Final summary ──────────────────────────────────────────────
        action = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"\n\n{'DRY RUN ' if dry_run else ''}Done.\n"
            f"  Organisations processed        : {orgs.count()}\n"
            f"  Orgs with no admin found       : {total_no_founder}\n"
            f"  {action} founder assignments   : {total_founder}\n"
            f"  {action} employee assignments  : {total_employee}\n"
            f"  Skipped (already existed)      : {total_skipped}\n"
        ))

        if not dry_run:
            self.stdout.write(
                "\nNext steps for each organisation:\n"
                "  1. Log in as the founder and decode JWT at jwt.io\n"
                "     Confirm platform_roles.hrms = 'hr_admin'\n"
                "  2. Assign Payroll Admin to the payroll person:\n"
                "     POST /api/v1/rbac/assignments/\n"
                "     { role_code: 'payroll_admin', platform: 'hrms' }\n"
                "  3. Assign Payroll Approver to a different person:\n"
                "     POST /api/v1/rbac/assignments/\n"
                "     { role_code: 'payroll_approver', platform: 'hrms' }\n"
            )

    # ─────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────

    def _load_roles(self):
        """Load all needed roles. Returns None if any are missing."""
        from apps.rbac.models import Role

        needed = [
            ("owner",     "all"),
            ("org_admin", "all"),
            ("hr_admin",  "hrms"),
            ("employee",  "hrms"),
        ]

        roles   = {}
        missing = []

        for code, platform in needed:
            role = Role.objects.filter(
                tenant_id=None,
                code=code,
                platform=platform,
            ).first()
            if role:
                roles[code] = role
            else:
                missing.append(f"{code} [{platform}]")

        if missing:
            self.stdout.write(self.style.ERROR(
                f"Missing roles. Run these commands first:\n"
                f"  python manage.py seed_platform_roles\n"
                f"  python manage.py seed_hrms_roles\n\n"
                f"Missing: {', '.join(missing)}\n"
            ))
            return None

        return roles

    def _create_assignment(
        self, dry_run, user, role,
        platform, scope_type, scope_id, today
    ):
        """
        Creates a RoleAssignment row.
        Returns: 'created' | 'exists' | 'dry_run'
        """
        from apps.rbac.models import RoleAssignment

        if dry_run:
            self.stdout.write(
                f"  Would assign: {role.code} [{platform}] → {user.email}"
            )
            return "dry_run"

        _, new = RoleAssignment.objects.get_or_create(
            user_id    = user.pk,
            role       = role,
            platform   = platform,
            scope_type = scope_type,
            scope_id   = scope_id,
            defaults   = {
                "valid_from":  today,
                "valid_to":    None,
                "assigned_by": None,
            },
        )
        return "created" if new else "exists"
