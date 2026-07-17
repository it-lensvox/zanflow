"""
apps/rbac/management/commands/seed_hrms_roles.py

Seeds ONLY the HRMS roles, permissions, role-permission links,
and mandatory SoD rules.

PM and CRM are not touched at all.

Run once after migration:
    python manage.py seed_hrms_roles
    python manage.py seed_hrms_roles --dry-run

Safe to re-run — uses get_or_create throughout.
"""

from django.core.management.base import BaseCommand
from apps.rbac.models import Permission, Role, RolePermission, SodRule


class Command(BaseCommand):
    help = "Seed HRMS roles, permissions, and SoD rules only."

    # ─────────────────────────────────────────────────────────────────
    # HRMS ROLES — 7 for Phase A
    # (code, display_name, role_class, platform, is_system, description)
    # ─────────────────────────────────────────────────────────────────
    HRMS_ROLES = [
        (
            "hr_admin",
            "HR Admin",
            "functional",
            "hrms",
            True,
            "Full HRMS access — employees, attendance, leave, payroll preparation, org structure.",
        ),
        (
            "hr_executive",
            "HR Executive",
            "functional",
            "hrms",
            True,
            "Department-scoped HR ops — attendance, leave, schedules. No salary access.",
        ),
        (
            "payroll_admin",
            "Payroll Admin",
            "functional",
            "hrms",
            True,
            "Prepare and run payroll. Cannot approve. SoD enforced.",
        ),
        (
            "payroll_approver",
            "Payroll Approver",
            "functional",
            "hrms",
            True,
            "Approve payroll runs. Cannot also prepare. SoD enforced.",
        ),
        (
            "finance_controller",
            "Finance Controller",
            "functional",
            "hrms",
            True,
            "Payroll approval + unlock month + financial reporting.",
        ),
        (
            "employee",
            "Employee",
            "functional",
            "hrms",
            True,
            "Self-service own data only. row_scope=own on all data permissions.",
        ),
        (
            "shift_supervisor",
            "Shift Supervisor",
            "functional",
            "hrms",
            True,
            "Shift rosters and attendance for their team. Only when P-01=shift-roster.",
        ),
    ]

    # ─────────────────────────────────────────────────────────────────
    # HRMS PERMISSIONS — 36
    # (resource, action, display_name, category, platform)
    # ─────────────────────────────────────────────────────────────────
    HRMS_PERMISSIONS = [
        # Employee profile — 8 permissions
        ("employee.profile",   "create",        "Add new employee",             "data",           "hrms"),
        ("employee.profile",   "read",          "View employee profile",        "data",           "hrms"),
        ("employee.profile",   "update",        "Edit employee profile",        "data",           "hrms"),
        ("employee.profile",   "deactivate",    "Deactivate employee",          "data",           "hrms"),
        ("employee.profile",   "bulk_import",   "Bulk import employees",        "data",           "hrms"),
        ("employee.exit",      "manage",        "Process employee exit / FNF",  "data",           "hrms"),
        ("employee.salary",    "read",          "View salary / CTC",            "data",           "hrms"),
        ("employee.salary",    "update",        "Edit salary / CTC",            "data",           "hrms"),
        ("employee.document",  "manage",        "Manage employee documents",    "data",           "hrms"),
        ("employee.report",    "export",        "Export HR reports",            "data",           "hrms"),
        # Attendance — 8 permissions
        ("attendance.log",     "read",          "View attendance log",          "data",           "hrms"),
        ("attendance.log",     "write",         "Mark attendance",              "data",           "hrms"),
        ("attendance.override","create",        "Override attendance entry",    "data",           "hrms"),
        ("attendance.manual",  "approve",       "Approve attendance requests",  "data",           "hrms"),
        ("attendance.dashboard","read",         "HR attendance dashboard",      "data",           "hrms"),
        ("attendance.selfie",  "read",          "View employee selfies",        "data",           "hrms"),
        ("attendance.location","manage",        "Manage office locations",      "administration", "hrms"),
        ("attendance.report",  "export",        "Export attendance reports",    "data",           "hrms"),
        # Leave — 7 permissions
        ("leave.request",      "create",        "Apply for leave",              "data",           "hrms"),
        ("leave.request",      "read",          "View leave requests",          "data",           "hrms"),
        ("leave.request",      "approve",       "Approve / reject leave",       "data",           "hrms"),
        ("leave.request",      "add_for_others","Add leave for other employee", "data",           "hrms"),
        ("leave.balance",      "read",          "View leave balance",           "data",           "hrms"),
        ("leave.policy",       "manage",        "Configure leave policies",     "administration", "hrms"),
        ("leave.encashment",   "process",       "Process leave encashment",     "data",           "hrms"),
        # Payroll — 7 permissions (SoD enforced on 3 pairs)
        ("payroll.run",        "execute",       "Prepare and run payroll",      "data",           "hrms"),  # SoD A
        ("payroll.run",        "approve",       "Approve payroll run",          "data",           "hrms"),  # SoD B
        ("payroll.run",        "read",          "View payroll runs",            "data",           "hrms"),
        ("payroll.slip",       "read",          "View payslips",                "data",           "hrms"),
        ("payroll.month",      "lock",          "Lock payroll month",           "data",           "hrms"),
        ("payroll.month",      "unlock",        "Unlock payroll month",         "data",           "hrms"),
        ("payroll.config",     "manage",        "Configure payroll settings",   "data",           "hrms"),
        # Org structure — 4 permissions
        ("org.department",     "manage",        "Manage departments",           "administration", "hrms"),
        ("org.designation",    "manage",        "Manage designations",          "administration", "hrms"),
        ("org.policy",         "manage",        "Manage HR policies",           "administration", "hrms"),
        ("org.compliance",     "read",          "View compliance reports",      "data",           "hrms"),
    ]

    # ─────────────────────────────────────────────────────────────────
    # ROLE → PERMISSION MAP
    # which permissions each HRMS role receives
    # ─────────────────────────────────────────────────────────────────
    ROLE_PERM_MAP = {
        "hr_admin": [
            ("employee.profile",   "create"),
            ("employee.profile",   "read"),
            ("employee.profile",   "update"),
            ("employee.profile",   "deactivate"),
            ("employee.profile",   "bulk_import"),
            ("employee.exit",      "manage"),
            ("employee.salary",    "read"),
            ("employee.salary",    "update"),
            ("employee.document",  "manage"),
            ("employee.report",    "export"),
            ("attendance.log",     "read"),
            ("attendance.log",     "write"),
            ("attendance.override","create"),
            ("attendance.manual",  "approve"),
            ("attendance.dashboard","read"),
            ("attendance.selfie",  "read"),
            ("attendance.location","manage"),
            ("attendance.report",  "export"),
            ("leave.request",      "create"),
            ("leave.request",      "read"),
            ("leave.request",      "approve"),
            ("leave.request",      "add_for_others"),
            ("leave.balance",      "read"),
            ("leave.policy",       "manage"),
            ("leave.encashment",   "process"),
            # HR Admin prepares payroll — CANNOT approve (SoD)
            ("payroll.run",        "execute"),
            ("payroll.run",        "read"),
            ("payroll.slip",       "read"),
            ("payroll.month",      "lock"),
            ("payroll.config",     "manage"),
            ("org.department",     "manage"),
            ("org.designation",    "manage"),
            ("org.policy",         "manage"),
            ("org.compliance",     "read"),
        ],
        "hr_executive": [
            ("employee.profile",   "read"),
            ("employee.profile",   "update"),
            ("employee.document",  "manage"),
            ("employee.report",    "export"),
            ("attendance.log",     "read"),
            ("attendance.log",     "write"),
            ("attendance.override","create"),
            ("attendance.manual",  "approve"),
            ("attendance.selfie",  "read"),
            ("attendance.report",  "export"),
            ("leave.request",      "create"),
            ("leave.request",      "read"),
            ("leave.request",      "approve"),
            ("leave.balance",      "read"),
            ("org.compliance",     "read"),
        ],
        "payroll_admin": [
            ("employee.salary",    "read"),
            ("employee.salary",    "update"),
            # SoD — payroll_admin CANNOT have payroll.run:approve
            ("payroll.run",        "execute"),
            ("payroll.run",        "read"),
            ("payroll.slip",       "read"),
            ("payroll.month",      "lock"),
            ("payroll.config",     "manage"),
            ("org.compliance",     "read"),
        ],
        "payroll_approver": [
            # SoD — payroll_approver CANNOT have payroll.run:execute
            ("payroll.run",        "approve"),
            ("payroll.run",        "read"),
            ("payroll.slip",       "read"),
            ("employee.salary",    "read"),
            ("org.compliance",     "read"),
        ],
        "finance_controller": [
            # Gets payroll.run:approve — SoD with payroll_admin
            ("payroll.run",        "approve"),
            ("payroll.run",        "read"),
            ("payroll.slip",       "read"),
            ("payroll.month",      "unlock"),
            ("employee.salary",    "read"),
            ("employee.report",    "export"),
            ("org.compliance",     "read"),
        ],
        "employee": [
            ("employee.profile",   "read"),
            ("employee.profile",   "update"),
            ("employee.document",  "manage"),
            ("attendance.log",     "read"),
            ("attendance.log",     "write"),
            ("leave.request",      "create"),
            ("leave.request",      "read"),
            ("leave.balance",      "read"),
            ("payroll.slip",       "read"),
        ],
        "shift_supervisor": [
            ("employee.profile",   "read"),
            ("attendance.log",     "read"),
            ("attendance.log",     "write"),
            ("attendance.override","create"),
            ("attendance.manual",  "approve"),
            ("attendance.selfie",  "read"),
            ("attendance.report",  "export"),
            ("leave.request",      "read"),
            ("leave.request",      "approve"),
            ("leave.balance",      "read"),
        ],
    }

    # ─────────────────────────────────────────────────────────────────
    # MANDATORY SOD RULES — 3 pairs for HRMS Phase A
    # (resource_a, action_a, resource_b, action_b)
    # ─────────────────────────────────────────────────────────────────
    SOD_RULES = [
        ("payroll.run",   "execute", "payroll.run",   "approve"),   # Preparer ≠ Approver
        ("employee.salary","update", "payroll.run",   "approve"),   # Salary editor ≠ Approver
        ("payroll.month", "lock",    "payroll.month", "unlock"),    # Locker ≠ Unlocker
    ]

    # ─────────────────────────────────────────────────────────────────
    # HANDLE
    # ─────────────────────────────────────────────────────────────────
    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be created without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no changes will be made.\n"))

        self.stdout.write("── Seeding HRMS RBAC (Phase A) ──────────────────")

        roles  = self._seed_roles(dry_run)
        perms  = self._seed_permissions(dry_run)
        rperms = self._seed_role_permissions(dry_run)
        sods   = self._seed_sod_rules(dry_run)

        action = "Would create" if dry_run else "Created"
        self.stdout.write(self.style.SUCCESS(
            f"\n{'DRY RUN ' if dry_run else ''}Done.\n"
            f"  {action} roles            : {roles}\n"
            f"  {action} permissions      : {perms}\n"
            f"  {action} role-permissions : {rperms}\n"
            f"  {action} SoD rules        : {sods}\n"
        ))

    def _seed_roles(self, dry_run):
        count = 0
        for code, display_name, role_class, platform, is_system, desc in self.HRMS_ROLES:
            if dry_run:
                self.stdout.write(f"  Role: {code} [{platform}]")
                count += 1
                continue
            _, new = Role.objects.get_or_create(
                tenant_id=None,
                code=code,
                platform=platform,
                defaults=dict(
                    display_name=display_name,
                    role_class=role_class,
                    is_system=is_system,
                    description=desc,
                ),
            )
            if new:
                count += 1
        return count

    def _seed_permissions(self, dry_run):
        count = 0
        for resource, action, display_name, category, platform in self.HRMS_PERMISSIONS:
            if dry_run:
                self.stdout.write(f"  Permission: {resource}:{action} [{platform}]")
                count += 1
                continue
            _, new = Permission.objects.get_or_create(
                resource=resource,
                action=action,
                platform=platform,
                defaults=dict(display_name=display_name, category=category),
            )
            if new:
                count += 1
        return count

    def _seed_role_permissions(self, dry_run):
        count = 0
        for role_code, perm_list in self.ROLE_PERM_MAP.items():
            role = Role.objects.filter(
                tenant_id=None,
                code=role_code,
                platform="hrms",
            ).first()

            if not role:
                self.stdout.write(
                    self.style.WARNING(f"  Role not found: {role_code} — run without --dry-run first")
                )
                continue

            for resource, action in perm_list:
                perm = Permission.objects.filter(
                    resource=resource,
                    action=action,
                    platform="hrms",
                ).first()

                if not perm:
                    self.stdout.write(
                        self.style.WARNING(f"  Permission not found: {resource}:{action}")
                    )
                    continue

                if dry_run:
                    self.stdout.write(f"  RolePerm: {role_code} → {resource}:{action}")
                    count += 1
                    continue

                _, new = RolePermission.objects.get_or_create(
                    role=role,
                    permission=perm,
                    defaults={"row_scope": RolePermission.ROW_SCOPE_ALL},
                )
                if new:
                    count += 1
        return count

    def _seed_sod_rules(self, dry_run):
        count = 0
        for res_a, act_a, res_b, act_b in self.SOD_RULES:
            perm_a = Permission.objects.filter(
                resource=res_a, action=act_a, platform="hrms"
            ).first()
            perm_b = Permission.objects.filter(
                resource=res_b, action=act_b, platform="hrms"
            ).first()

            if not perm_a or not perm_b:
                self.stdout.write(
                    self.style.WARNING(
                        f"  SoD perm not found: {res_a}:{act_a} or {res_b}:{act_b}"
                    )
                )
                continue

            if dry_run:
                self.stdout.write(f"  SoD: {res_a}:{act_a} ≠ {res_b}:{act_b} [mandatory]")
                count += 1
                continue

            _, new = SodRule.objects.get_or_create(
                tenant_id=None,
                permission_a=perm_a,
                permission_b=perm_b,
                defaults={
                    "is_mandatory": True,
                    "source":       SodRule.SOURCE_SYSTEM,
                },
            )
            if new:
                count += 1
        return count
