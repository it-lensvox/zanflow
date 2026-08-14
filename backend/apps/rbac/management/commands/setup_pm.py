"""
apps/rbac/management/commands/setup_pm.py

Sets up PM roles for all existing users.

WHAT THIS DOES:
    1. Migrates old User.role values to new PM RoleAssignment rows
    2. Assigns pm_admin to org founders (first admin user per org)
    3. Assigns workspace_member to all other users at org scope
    4. workspace_admin is assigned separately — automatically when a
       user creates a workspace (not done here)

OLD ROLE → NEW ROLE MIGRATION:
    admin     → pm_admin       (top PM role)
    manager   → project_member (reassigned at project level by pm_admin)
    developer → project_member (reassigned at project level by pm_admin)
    annotator → project_viewer (read-only — matched to annotator behaviour)
    viewer    → project_viewer (read-only — no change in behaviour)

    NOTE: project_manager, project_admin, project_member, project_viewer
    are PROJECT-SCOPE roles. They cannot be assigned at org scope.
    Only pm_admin and workspace_member are org-scope roles.
    After setup_pm runs — pm_admin should invite users to specific projects
    and assign them the correct project-scope role from the PM admin panel.

AUTHORITY CHAIN:
    pm_admin is the TOP role inside PM.
    pm_admin can ONLY be assigned by security_admin or owner from Central.
    All other PM roles are assigned by pm_admin from the PM admin panel.

Usage:
    python manage.py setup_pm
    python manage.py setup_pm --org-id 5
    python manage.py setup_pm --dry-run
    python manage.py setup_pm --org-id 5 --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = (
        "Setup PM roles for all organisations. "
        "Migrates old User.role to new PM RoleAssignment rows. "
        "Run after seed_pm_roles."
    )

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
            help="Only setup PM for this specific organisation ID.",
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

        # ── Load PM roles ──────────────────────────────────────────────
        roles = self._load_roles()
        if not roles:
            return

        # ── Find all unique org_ids ────────────────────────────────────
        user_qs = (
            User.objects
            .filter(is_active=True)
            .exclude(organization_id__isnull=True)
            .exclude(is_superuser=True)
        )
        if org_id:
            user_qs = user_qs.filter(organization_id=org_id)

        org_ids = sorted(set(
            user_qs.values_list("organization_id", flat=True)
        ))

        if not org_ids:
            self.stdout.write(self.style.ERROR(
                f"No active users found"
                f"{f' in org id={org_id}' if org_id else ''}.\n"
            ))
            return

        self.stdout.write(
            f"Processing {len(org_ids)} organisation(s).\n"
        )

        total_pm_admin  = 0
        total_member    = 0
        total_skipped   = 0
        total_no_founder = 0

        for oid in org_ids:
            self.stdout.write(
                f"\n── Organisation id={oid} ─────────────────────────────"
            )

            # ── Detect founder ─────────────────────────────────────────
            # Founder = first admin user by lowest primary key
            founder = User.objects.filter(
                organization_id = oid,
                role            = "admin",
                is_active       = True,
            ).order_by("id").first()

            if not founder:
                self.stdout.write(self.style.WARNING(
                    f"  No admin user found for org id={oid} — skipping."
                ))
                total_no_founder += 1
                continue

            self.stdout.write(f"  Founder: {founder.email} (id={founder.pk})")

            # ── Assign pm_admin to founder ─────────────────────────────
            result = self._assign(
                dry_run, founder, roles["pm_admin"],
                "pm", "organization", oid, today,
            )
            if result in ("created", "dry_run"):
                total_pm_admin += 1
                if not dry_run:
                    self.stdout.write(self.style.SUCCESS(
                        f"  \u2713 pm_admin [pm] \u2192 {founder.email}"
                    ))
            elif result == "exists":
                total_skipped += 1
                self.stdout.write(
                    f"  = pm_admin already exists \u2192 {founder.email}"
                )

            # ── Assign workspace_member to all other users ─────────────
            others = (
                User.objects
                .filter(organization_id=oid, is_active=True)
                .exclude(pk=founder.pk)
                .exclude(is_superuser=True)
            )

            self.stdout.write(
                f"  Assigning workspace_member to {others.count()} other user(s)..."
            )

            for user in others.order_by("id"):
                result = self._assign(
                    dry_run, user, roles["workspace_member"],
                    "pm", "organization", oid, today,
                )
                if result in ("created", "dry_run"):
                    total_member += 1
                    if not dry_run:
                        # Show old role so we know what was migrated
                        old_role = getattr(user, "role", "unknown")
                        self.stdout.write(
                            f"  \u2713 workspace_member [pm] \u2192 {user.email} "
                            f"(was: {old_role})"
                        )
                elif result == "exists":
                    total_skipped += 1

        action = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"\n{'DRY RUN ' if dry_run else ''}Done.\n"
            f"  Orgs processed            : {len(org_ids)}\n"
            f"  Orgs without founder      : {total_no_founder}\n"
            f"  {action} pm_admin         : {total_pm_admin}\n"
            f"  {action} workspace_member : {total_member}\n"
            f"  Skipped (already existed) : {total_skipped}\n"
        ))

        if not dry_run:
            self.stdout.write(
                "\nNext steps:\n"
                "  1. Login as founder → decode JWT at jwt.io\n"
                "     Confirm: platform_roles.pm = 'pm_admin'\n"
                "  2. From PM admin panel — assign project-scope roles:\n"
                "     Invite users to specific projects\n"
                "     Assign project_admin / project_manager / project_member\n"
                "     as appropriate per project\n"
                "\n  NOTE: workspace_admin is assigned automatically when\n"
                "  a user creates a workspace — not by this command.\n"
                "\n  NOTE: Each role assignment fires a webhook to Central.\n"
                "  Central PlatformRoleCache is updated automatically.\n"
            )

    # ─────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────

    def _load_roles(self):
        """Load PM roles only. Central roles are NOT loaded here."""
        from apps.rbac.models import Role

        needed = [
            ("pm_admin",         "pm"),
            ("workspace_member", "pm"),
        ]
        roles, missing = {}, []

        for code, platform in needed:
            role = Role.objects.filter(
                tenant_id=None, code=code, platform=platform
            ).first()
            if role:
                roles[code] = role
            else:
                missing.append(f"{code} [{platform}]")

        if missing:
            self.stdout.write(self.style.ERROR(
                f"Missing PM roles — run seed_pm_roles first:\n"
                f"  python manage.py seed_pm_roles\n\n"
                f"Missing: {', '.join(missing)}\n"
            ))
            return None
        return roles

    def _assign(
        self, dry_run, user, role,
        platform, scope_type, scope_id, today,
    ):
        """
        Create a RoleAssignment row.
        Returns: 'created' | 'exists' | 'dry_run'
        """
        from apps.rbac.models import RoleAssignment

        if dry_run:
            old_role = getattr(user, "role", "unknown")
            self.stdout.write(
                f"  Would assign: {role.code} [pm] \u2192 {user.email} "
                f"(was: {old_role})"
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
