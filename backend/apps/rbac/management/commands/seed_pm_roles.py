"""
apps/rbac/management/commands/seed_pm_roles.py

Seeds ONLY the PM roles, permissions, role-permission links,
and SoD rules into the PM backend database.

ARCHITECTURE:
    PM owns Gates 3 and 4 of the 4-gate access model:
        Gate 3 — Scope role check  (PM checks its own role_assignments)
        Gate 4 — Permission check  (PM checks its own permissions)

    Central owns Gates 1 and 2:
        Gate 1 — Subscription check
        Gate 2 — Portal grant check

PM ROLES (7):
    Workspace scope:
        pm_admin          — Full PM config. All workspaces. Top PM role.
        workspace_admin   — Admin of one workspace. Creates projects.
        workspace_member  — Default. Can see workspaces. Joins when invited.

    Project scope (one role per user per project):
        project_admin     — Full control within one project.
        project_manager   — Manage tasks and team. No destructive access.
        project_member    — Day-to-day contributor. Create and update own tasks.
        project_viewer    — Read-only. Cannot create, update, or comment.

OLD ROLE MIGRATION:
    admin     → pm_admin (top PM role)
    manager   → project_manager
    developer → project_member
    annotator → project_viewer
    viewer    → project_viewer

AUTHORITY CHAIN:
    owner (Central) > security_admin (Central) > pm_admin (PM)
    pm_admin is the TOP role inside PM.
    pm_admin can ONLY be assigned by security_admin or owner from Central.
    All other PM roles are assigned by pm_admin from the PM admin panel.

Run AFTER seed_platform_roles:
    python manage.py seed_platform_roles   (in Central backend)
    python manage.py seed_pm_roles         (this command — in PM backend)
    python manage.py setup_pm              (assign roles to existing users)

Safe to re-run — uses get_or_create. Idempotent.
"""

from django.core.management.base import BaseCommand
from apps.rbac.models import Role, Permission, RolePermission, SodRule


# ── PM Permissions ────────────────────────────────────────────────────
# Format: (code, resource, action, row_scope)
# row_scope: "all" | "own" | "team" | "scope"
PM_PERMISSIONS = [
    # Workspace permissions
    ("workspace:create",             "workspace",        "create",       "all"),
    ("workspace:delete",             "workspace",        "delete",       "all"),
    ("workspace:settings",           "workspace",        "settings",     "all"),
    ("workspace:export_all",         "workspace",        "export_all",   "all"),
    ("workspace.member:invite",      "workspace.member", "invite",       "all"),
    ("workspace.member:remove",      "workspace.member", "remove",       "all"),
    ("workspace.member:assign_role", "workspace.member", "assign_role",  "all"),
    ("workspace.audit_log:read",     "workspace.audit_log", "read",      "all"),
    ("workspace.integration:manage", "workspace.integration", "manage",  "all"),

    # Project permissions
    ("project:create",               "project",          "create",       "all"),
    ("project:delete",               "project",          "delete",       "all"),
    ("project:settings",             "project",          "settings",     "all"),
    ("project:archive",              "project",          "archive",      "all"),
    ("project:export",               "project",          "export",       "all"),
    ("project.member:add",           "project.member",   "add",          "all"),
    ("project.member:remove",        "project.member",   "remove",       "all"),
    ("project.member:assign_role",   "project.member",   "assign_role",  "all"),
    ("project.audit_log:read",       "project.audit_log","read",         "all"),

    # Task permissions
    ("task:create",                  "task",             "create",       "all"),
    ("task:read",                    "task",             "read",         "all"),
    ("task:update_any",              "task",             "update_any",   "all"),
    ("task:update_own",              "task",             "update_own",   "own"),
    ("task:assign",                  "task",             "assign",       "all"),
    ("task:delete",                  "task",             "delete",       "all"),
    ("task:approve_close",           "task",             "approve_close","all"),
    ("task:comment",                 "task",             "comment",      "all"),
    ("task:log_time",                "task",             "log_time",     "all"),

    # Sprint and milestone
    ("sprint:manage",                "sprint",           "manage",       "all"),
    ("milestone:manage",             "milestone",        "manage",       "all"),
    ("backlog:manage",               "backlog",          "manage",       "all"),

    # Documents
    ("document:upload",              "document",         "upload",       "all"),
    ("document:read",                "document",         "read",         "all"),
    ("document:delete",              "document",         "delete",       "all"),

    # Reports
    ("report:read",                  "report",           "read",         "all"),
    ("report:export",                "report",           "export",       "all"),

    # Integration and labels
    ("integration:manage",           "integration",      "manage",       "all"),
    ("label:manage",                 "label",            "manage",       "all"),
    ("custom_field:manage",          "custom_field",     "manage",       "all"),
]


# ── PM Role Definitions ────────────────────────────────────────────────
# Format: (code, display_name, description, [permission_codes])
PM_ROLES = [
    (
        "pm_admin",
        "PM Admin",
        "Full PM configuration. All workspaces, all data, all settings. "
        "Top PM role — can only be assigned by security_admin or owner from Central.",
        [
            "workspace:create", "workspace:delete", "workspace:settings",
            "workspace:export_all", "workspace.member:invite",
            "workspace.member:remove", "workspace.member:assign_role",
            "workspace.audit_log:read", "workspace.integration:manage",
            "project:create", "project:delete", "project:settings",
            "project:archive", "project:export",
            "project.member:add", "project.member:remove",
            "project.member:assign_role", "project.audit_log:read",
            "task:create", "task:read", "task:update_any", "task:update_own",
            "task:assign", "task:delete", "task:approve_close",
            "task:comment", "task:log_time",
            "sprint:manage", "milestone:manage", "backlog:manage",
            "document:upload", "document:read", "document:delete",
            "report:read", "report:export",
            "integration:manage", "label:manage", "custom_field:manage",
        ],
    ),
    (
        "workspace_admin",
        "Workspace Admin",
        "Admin of one workspace. Create and delete projects. "
        "Manage workspace members. Assigned automatically to the user "
        "who creates the workspace.",
        [
            "workspace:settings", "workspace:export_all",
            "workspace.member:invite", "workspace.member:remove",
            "workspace.member:assign_role", "workspace.audit_log:read",
            "workspace.integration:manage",
            "project:create", "project:delete", "project:settings",
            "project:archive", "project:export",
            "project.member:add", "project.member:remove",
            "project.member:assign_role",
            "task:create", "task:read", "task:update_any", "task:update_own",
            "task:assign", "task:delete", "task:approve_close",
            "task:comment", "task:log_time",
            "sprint:manage", "milestone:manage", "backlog:manage",
            "document:upload", "document:read", "document:delete",
            "report:read", "report:export",
            "integration:manage", "label:manage", "custom_field:manage",
        ],
    ),
    (
        "workspace_member",
        "Workspace Member",
        "Default role for all new PM users. Can see workspaces exist. "
        "Joins projects when invited by workspace_admin. "
        "Gets a project-scope role when added to a specific project.",
        [
            "document:read",
            "report:read",
        ],
    ),
    (
        "project_admin",
        "Project Admin",
        "Full control within one project. Configure settings, milestones, "
        "sprints. Add and remove members. Cannot approve own tasks (SoD).",
        [
            "project:delete", "project:settings", "project:archive",
            "project:export",
            "project.member:add", "project.member:remove",
            "project.member:assign_role", "project.audit_log:read",
            "task:create", "task:read", "task:update_any", "task:update_own",
            "task:assign", "task:delete", "task:approve_close",
            "task:comment", "task:log_time",
            "sprint:manage", "milestone:manage", "backlog:manage",
            "document:upload", "document:read", "document:delete",
            "report:read", "report:export",
            "label:manage", "custom_field:manage",
        ],
    ),
    (
        "project_manager",
        "Project Manager",
        "Manage tasks and team within a project. No destructive access. "
        "Cannot delete the project. Cannot approve own tasks (SoD).",
        [
            "project.member:add",
            "task:create", "task:read", "task:update_any", "task:update_own",
            "task:assign", "task:delete", "task:approve_close",
            "task:comment", "task:log_time",
            "sprint:manage", "milestone:manage", "backlog:manage",
            "document:upload", "document:read",
            "report:read", "report:export",
            "label:manage",
        ],
    ),
    (
        "project_member",
        "Project Member",
        "Day-to-day contributor. Create and update own tasks. "
        "Comment and log time. Cannot assign tasks to others. "
        "Maps from old roles: developer.",
        [
            "task:create", "task:read", "task:update_own",
            "task:comment", "task:log_time",
            "document:upload", "document:read",
            "report:read",
        ],
    ),
    (
        "project_viewer",
        "Project Viewer",
        "Read-only access to everything within the project. "
        "Cannot create, update, comment, or delete. "
        "Maps from old roles: viewer, annotator.",
        [
            "task:read",
            "document:read",
            "report:read",
        ],
    ),
]


# ── PM SoD Rules ───────────────────────────────────────────────────────
# task:create ⊗ task:approve_close
# Task creator cannot approve their own task (record-level enforcement).
PM_SOD_RULES = [
    (
        "task:create",        # permission_a code
        "task:approve_close", # permission_b code
    ),
]


class Command(BaseCommand):
    help = (
        "Seed 7 PM roles, 37 permissions, and 1 SoD rule into the PM database. "
        "Run after seed_platform_roles. Safe to re-run — idempotent."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be created without writing anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING(
                "DRY RUN — no changes will be made.\n"
            ))

        self.stdout.write("── Step 1: Seeding PM permissions ─────────────────")
        perm_created  = 0
        perm_skipped  = 0
        perm_objects  = {}

        for code, resource, action, row_scope in PM_PERMISSIONS:
            if dry_run:
                self.stdout.write(f"  Would create permission: {code}")
                perm_created += 1
                continue

            # Permission model uses resource + action as unique key
            # code is a @property — NOT a DB column
            perm, new = Permission.objects.get_or_create(
                resource = resource,
                action   = action,
                platform = "pm",
                defaults = {
                    "display_name": code.replace(":", " ").replace(".", " "),
                    "category":     "data",
                },
            )
            perm_objects[code] = perm
            if new:
                perm_created += 1
            else:
                perm_skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"  Permissions: {perm_created} created, {perm_skipped} already existed.\n"
        ))

        self.stdout.write("── Step 2: Seeding PM roles ────────────────────────")
        role_created = 0
        role_skipped = 0

        for code, display_name, description, perm_codes in PM_ROLES:
            if dry_run:
                self.stdout.write(
                    f"  Would create role: {code} ({len(perm_codes)} permissions)"
                )
                role_created += 1
                continue

            role, new = Role.objects.get_or_create(
                tenant_id = None,
                code      = code,
                platform  = "pm",
                defaults  = {
                    "display_name": display_name,
                    "description":  description,
                    "role_class":   Role.CLASS_FUNCTIONAL,
                    "is_system":    True,
                },
            )

            if new:
                role_created += 1
                self.stdout.write(
                    f"  Created: {code} ({len(perm_codes)} permissions)"
                )
            else:
                role_skipped += 1
                self.stdout.write(f"  Exists : {code} — skipped")
                continue

            # Link permissions to role
            for perm_code in perm_codes:
                perm = perm_objects.get(perm_code)
                if not perm:
                    self.stdout.write(self.style.WARNING(
                        f"    ⚠ Permission not found: {perm_code}"
                    ))
                    continue

                # Determine row_scope for this permission
                perm_def = next(
                    (p for p in PM_PERMISSIONS if p[0] == perm_code), None
                )
                row_scope = perm_def[3] if perm_def else "all"

                RolePermission.objects.get_or_create(
                    role       = role,
                    permission = perm,
                    defaults   = {"row_scope": row_scope},
                )

        self.stdout.write(self.style.SUCCESS(
            f"  Roles: {role_created} created, {role_skipped} already existed.\n"
        ))

        self.stdout.write("── Step 3: Seeding PM SoD rules ────────────────────")
        sod_created = 0
        sod_skipped = 0

        for perm_a, perm_b in PM_SOD_RULES:
            if dry_run:
                self.stdout.write(
                    f"  Would create SoD: {perm_a} ⊗ {perm_b}"
                )
                sod_created += 1
                continue

            perm_a_obj = perm_objects.get(perm_a)
            perm_b_obj = perm_objects.get(perm_b)

            if not perm_a_obj or not perm_b_obj:
                self.stdout.write(self.style.WARNING(
                    f"  ⚠ SoD skipped — permission not found: {perm_a} or {perm_b}"
                ))
                continue

            # SodRule fields: tenant_id, permission_a, permission_b,
            # is_mandatory, source. No level/description/is_active fields.
            _, new = SodRule.objects.get_or_create(
                tenant_id    = None,   # global — applies to all tenants
                permission_a = perm_a_obj,
                permission_b = perm_b_obj,
                defaults     = {
                    "is_mandatory": True,
                    "source":       SodRule.SOURCE_SYSTEM,
                },
            )
            if new:
                sod_created += 1
                self.stdout.write(
                    f"  Created SoD: {perm_a} ⊗ {perm_b}"
                )
            else:
                sod_skipped += 1
                self.stdout.write(
                    f"  Exists SoD: {perm_a} ⊗ {perm_b} — skipped"
                )

        self.stdout.write(self.style.SUCCESS(
            f"  SoD rules: {sod_created} created, {sod_skipped} already existed.\n"
        ))

        action = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"{'DRY RUN ' if dry_run else ''}Done.\n"
            f"  {action} : {perm_created} permissions\n"
            f"  {action} : {role_created} roles\n"
            f"  {action} : {sod_created} SoD rules\n"
            f"\nNext step:\n"
            f"  python manage.py setup_pm\n"
        ))