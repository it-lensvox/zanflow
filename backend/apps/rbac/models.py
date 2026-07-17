"""
apps/rbac/models.py

Role Based Access Control for Dyuksa — Central Auth on PM backend.

This app is the SINGLE SOURCE OF TRUTH for roles across all platforms:
    PM · HRMS · CRM · (IMS in Phase B)

WHY IT LIVES IN THE PM BACKEND:
    The PM backend is the Central Auth server. It issues all JWTs.
    Every HRMS and CRM request validates the same JWT.
    Roles for all platforms are stored here — not in HRMS or CRM.
    This is Option A — confirmed architecture decision.

ZERO COUPLING:
    This app does NOT import from apps.projects, apps.teams,
    apps.tasksite, or any other Dyuksa app. It only imports from
    django.conf.settings for AUTH_USER_MODEL.

EXISTING PM CODE IS UNTOUCHED:
    User.role, WorkspaceMembership.role, and all existing PM views
    continue working exactly as before. This app adds new tables
    alongside the existing ones. Old system removed only in Phase 7.

Tables:
    Permission      — resource:action strings with category
    Role            — role definitions (template or tenant clone)
    RolePermission  — role → permission links with row_scope
    RoleAssignment  — user → role at a scope, time-bounded
    SodRule         — SoD permission pairs (never role pairs)
    ScopeNode       — scope object registry
    ScopeClosure    — ancestor/descendant pairs for O(1) containment

Architecture decisions embedded:
    Decision 1: Permission.category = data | administration
    Decision 2: SodRule stores permission pairs, not role pairs
    Decision 3: ScopeClosure for fast scope containment
    Decision 4: annotator → project_viewer migration mapping
"""

from django.db import models
from django.conf import settings


# ─────────────────────────────────────────────────────────────────────
# 1. Permission
# ─────────────────────────────────────────────────────────────────────

class Permission(models.Model):
    """
    One atomic action on one resource across any Dyuksa platform.

    Permission string format:  resource:action
    Examples:
        task:create
        payroll.run:approve
        employee.salary:read
        workspace.member:invite

    category (Decision 1):
        'data'           — controls what data the user can see/edit/delete.
                           Resolution: most specific scope wins.
        'administration' — controls system management (invite, settings).
                           Resolution: highest authority platform role wins.

    field_scope:
        NULL in Phase A/B. Used in Phase C to protect sensitive fields
        like salary, PAN, Aadhaar at field level inside a permission.
    """

    # ── Platform choices ──────────────────────────────────────────────
    PLATFORM_PM   = "pm"
    PLATFORM_HRMS = "hrms"
    PLATFORM_CRM  = "crm"
    PLATFORM_IMS  = "ims"
    PLATFORM_ALL  = "all"
    PLATFORM_CHOICES = [
        (PLATFORM_PM,   "Project Management"),
        (PLATFORM_HRMS, "HRMS"),
        (PLATFORM_CRM,  "CRM"),
        (PLATFORM_IMS,  "IMS / Finance"),
        (PLATFORM_ALL,  "All Platforms"),
    ]

    # ── Category choices (Decision 1) ─────────────────────────────────
    CATEGORY_DATA           = "data"
    CATEGORY_ADMINISTRATION = "administration"
    CATEGORY_CHOICES = [
        (CATEGORY_DATA,           "Data"),
        (CATEGORY_ADMINISTRATION, "Administration"),
    ]

    # e.g. "task", "project.member", "payroll.run", "employee.salary"
    resource     = models.CharField(max_length=100)
    # e.g. "create", "read", "update", "delete", "approve", "execute"
    action       = models.CharField(max_length=50)
    display_name = models.CharField(max_length=150)
    platform     = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default=PLATFORM_PM)
    category     = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_DATA)
    # Phase C field-level permissions — NULL for now
    field_scope  = models.CharField(max_length=100, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("resource", "action", "platform")
        ordering        = ["platform", "resource", "action"]
        verbose_name    = "Permission"
        verbose_name_plural = "Permissions"

    def __str__(self):
        return f"{self.resource}:{self.action} [{self.platform}]"

    @property
    def code(self):
        """The permission string — e.g. 'task:create'"""
        return f"{self.resource}:{self.action}"


# ─────────────────────────────────────────────────────────────────────
# 2. Role
# ─────────────────────────────────────────────────────────────────────

class Role(models.Model):
    """
    A named collection of permissions.

    tenant_id NULL  → Dyuksa template. Upgrades only touch these rows.
                      Never modified by tenants.
    tenant_id SET   → Tenant clone or custom role.
                      Tenant can modify display_name freely.
                      Custom roles are capped at 30 per tenant (enforced
                      in the role creation API, not here).

    role_class:
        'platform'   — Owner, Org Admin, Billing Admin, Auditor.
                       is_system=True. Never deletable.
        'functional' — HR Admin, Project Admin, Sales Exec etc.
                       Shipped by Dyuksa. Cloned per tenant on signup.
        'custom'     — Created by Org Admin via role builder (Phase C).

    code:
        Stable engine-facing key. Used in code and JWT.
        Never changes even if display_name is renamed by tenant.
        Examples: 'project_admin', 'hr_admin', 'org_admin'

    parent_role:
        For permission inheritance. Max depth 5.
        Validated in clean() AND enforced in pre_save signal to prevent
        direct ORM .save() bypass.
    """

    # ── Class choices ─────────────────────────────────────────────────
    CLASS_PLATFORM   = "platform"
    CLASS_FUNCTIONAL = "functional"
    CLASS_CUSTOM     = "custom"
    CLASS_CHOICES = [
        (CLASS_PLATFORM,   "Platform"),
        (CLASS_FUNCTIONAL, "Functional"),
        (CLASS_CUSTOM,     "Custom"),
    ]

    # NULL = Dyuksa template visible to all tenants
    tenant_id    = models.IntegerField(null=True, blank=True, db_index=True)
    platform     = models.CharField(max_length=20, choices=Permission.PLATFORM_CHOICES, default=Permission.PLATFORM_PM)
    role_class   = models.CharField(max_length=20, choices=CLASS_CHOICES, default=CLASS_FUNCTIONAL)
    code         = models.CharField(max_length=100, db_index=True)
    display_name = models.CharField(max_length=150)
    description  = models.TextField(blank=True, default="")
    parent_role  = models.ForeignKey(
        "self",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="child_roles",
    )
    # Platform roles and Dyuksa templates cannot be deleted
    is_system    = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tenant_id", "code", "platform")
        ordering        = ["platform", "role_class", "code"]
        verbose_name    = "Role"
        verbose_name_plural = "Roles"

    def __str__(self):
        tenant = f"tenant:{self.tenant_id}" if self.tenant_id else "template"
        return f"{self.code} [{self.platform}] ({tenant})"

    def clean(self):
        """
        Validate:
        1. Max inheritance depth of 5 levels.
        2. No circular parent_role references.

        NOTE: clean() only runs via ModelForms and full_clean().
        Direct ORM .save() bypasses it. The pre_save signal in
        apps/rbac/signals.py enforces the same check for all saves.
        """
        from django.core.exceptions import ValidationError

        if not self.parent_role_id:
            return

        depth   = 1
        current = self.parent_role
        visited = {self.pk}

        while current is not None:
            if current.pk in visited:
                raise ValidationError(
                    "Circular role inheritance detected. "
                    "A role cannot be its own ancestor."
                )
            visited.add(current.pk)
            depth += 1
            if depth > 5:
                raise ValidationError(
                    "Role inheritance cannot exceed 5 levels. "
                    "Flatten your role hierarchy."
                )
            current = current.parent_role


# ─────────────────────────────────────────────────────────────────────
# 3. RolePermission
# ─────────────────────────────────────────────────────────────────────

class RolePermission(models.Model):
    """
    Links a Role to a Permission with data-visibility scope.

    row_scope controls WHAT DATA the user can see, not whether they
    can perform the action. The same permission (employee.profile:read)
    has different row_scope values for different roles:
        HR Admin    → row_scope=all   (sees everyone)
        HR Executive → row_scope=dept (sees their department only)
        Employee    → row_scope=own   (sees themselves only)

    This is the Zoho / Keka data-visibility pattern.
    """

    ROW_SCOPE_OWN        = "own"
    ROW_SCOPE_TEAM       = "team"
    ROW_SCOPE_DEPARTMENT = "department"
    ROW_SCOPE_SCOPE      = "scope"
    ROW_SCOPE_ALL        = "all"
    ROW_SCOPE_CHOICES = [
        (ROW_SCOPE_OWN,        "Own records only"),
        (ROW_SCOPE_TEAM,       "Team records"),
        (ROW_SCOPE_DEPARTMENT, "Department records"),
        (ROW_SCOPE_SCOPE,      "Scope records"),
        (ROW_SCOPE_ALL,        "All records"),
    ]

    role       = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="role_permissions")
    row_scope  = models.CharField(max_length=20, choices=ROW_SCOPE_CHOICES, default=ROW_SCOPE_OWN)

    class Meta:
        unique_together = ("role", "permission")
        verbose_name    = "Role Permission"
        verbose_name_plural = "Role Permissions"

    def __str__(self):
        return f"{self.role.code} → {self.permission.code} [{self.row_scope}]"


# ─────────────────────────────────────────────────────────────────────
# 4. RoleAssignment  — THE SINGLE SOURCE OF TRUTH
# ─────────────────────────────────────────────────────────────────────

class RoleAssignment(models.Model):
    """
    Binds a user to a role within a specific scope for a specific time.

    Formula:  Access = Role (what) × Scope (where) × Assignment (who, when)

    SCOPE:
        scope_type + scope_id is a polymorphic pair.
        scope_type tells which model. scope_id is its PK.

        scope_type choices:
            tenant       → the entire Dyuksa tenant (org-wide)
            organization → a specific Organization
            workspace    → a specific Workspace (PM)
            project      → a specific Project (PM)
            team         → a specific Team (PM/HRMS)
            department   → a specific Department (HRMS)
            payroll_group→ a specific Payroll Group (HRMS)
            warehouse    → a specific Warehouse (IMS Phase B)

    TIME:
        valid_from  — when access starts. Required.
        valid_to    — when access ends. NULL = indefinite.
        Leaver flow sets valid_to = last_working_day.
        Permission resolver always checks both fields.

    PLATFORM:
        Which platform this assignment is for.
        Same user can have different assignments per platform.
        This enables: Ravi = Project Admin in PM, Employee in HRMS.

    ASSIGNED_BY:
        Who created this assignment. Required for audit trail.
        NULL only for historical migrated data from old WorkspaceMembership.

    INDEXES:
        (user, platform, valid_from, valid_to) — fast login JWT build
        (scope_type, scope_id)                 — fast scope lookups
    """

    # ── Scope choices ─────────────────────────────────────────────────
    SCOPE_TENANT        = "tenant"
    SCOPE_ORGANIZATION  = "organization"
    SCOPE_WORKSPACE     = "workspace"
    SCOPE_PROJECT       = "project"
    SCOPE_TEAM          = "team"
    SCOPE_DEPARTMENT    = "department"
    SCOPE_PAYROLL_GROUP = "payroll_group"
    SCOPE_WAREHOUSE     = "warehouse"
    SCOPE_CHOICES = [
        (SCOPE_TENANT,        "Tenant"),
        (SCOPE_ORGANIZATION,  "Organization"),
        (SCOPE_WORKSPACE,     "Workspace"),
        (SCOPE_PROJECT,       "Project"),
        (SCOPE_TEAM,          "Team"),
        (SCOPE_DEPARTMENT,    "Department"),
        (SCOPE_PAYROLL_GROUP, "Payroll Group"),
        (SCOPE_WAREHOUSE,     "Warehouse"),
    ]

    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_assignments",
    )
    role       = models.ForeignKey(
        Role,
        # PROTECT: never silently delete a role that has live assignments
        on_delete=models.PROTECT,
        related_name="assignments",
    )
    platform   = models.CharField(max_length=20, choices=Permission.PLATFORM_CHOICES)
    scope_type = models.CharField(max_length=20, choices=SCOPE_CHOICES)
    scope_id   = models.IntegerField()
    valid_from = models.DateField()
    valid_to   = models.DateField(null=True, blank=True)   # NULL = indefinite
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="role_assignments_given",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["user", "platform", "valid_from", "valid_to"],
                name="rbac_assign_user_platform_idx",
            ),
            models.Index(
                fields=["scope_type", "scope_id"],
                name="rbac_assign_scope_idx",
            ),
        ]
        verbose_name        = "Role Assignment"
        verbose_name_plural = "Role Assignments"

    def __str__(self):
        return (
            f"{self.user_id} → {self.role.code} "
            f"[{self.platform}] @ {self.scope_type}:{self.scope_id}"
        )

    @property
    def is_active(self):
        """Returns True if this assignment is valid today."""
        from django.utils import timezone
        today = timezone.now().date()
        if self.valid_from > today:
            return False
        if self.valid_to and self.valid_to < today:
            return False
        return True


# ─────────────────────────────────────────────────────────────────────
# 5. SodRule  (Decision 2 — Permission-Level SoD)
# ─────────────────────────────────────────────────────────────────────

class SodRule(models.Model):
    """
    Separation of Duties rule stored as a PERMISSION pair.

    WHY PERMISSION PAIRS NOT ROLE PAIRS:
        Role-level SoD can be bypassed by creating a custom role that
        inherits conflicting permissions through the parent_role chain.
        Permission-level SoD checks the full flattened permission union
        regardless of how permissions were inherited — this cannot be
        bypassed.  (SAP GRC / Oracle IAG approach — confirmed Decision 2)

    VALIDATION RUNS AT TWO POINTS:
        1. Role creation time (Static)  — full flattened permission set
           of the new role is checked. Blocks role creation if any
           mandatory pair is violated.
        2. Assignment time (Dynamic)    — user's complete current
           permission union + new role's permissions are checked.
           Blocks assignment if any mandatory pair is violated.

    MANDATORY HRMS PHASE A PAIRS (is_mandatory=True, source=system):
        payroll.run:execute      ≠  payroll.run:approve
        employee.salary:update   ≠  payroll.run:approve
        payroll.month:lock       ≠  payroll.month:unlock

    is_mandatory=True:
        Cannot be deleted by any Org Admin. Seeded by Dyuksa.
        Compliance-grade control.

    tenant_id=NULL:
        Rule applies to all tenants globally.
    tenant_id=SET:
        Rule applies to one specific tenant only.
    """

    SOURCE_SYSTEM = "system"
    SOURCE_ADMIN  = "admin"
    SOURCE_CHOICES = [
        (SOURCE_SYSTEM, "System (Dyuksa)"),
        (SOURCE_ADMIN,  "Admin (Tenant)"),
    ]

    tenant_id    = models.IntegerField(null=True, blank=True, db_index=True)
    permission_a = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="sod_rules_as_a")
    permission_b = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="sod_rules_as_b")
    is_mandatory = models.BooleanField(default=False)
    source       = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_ADMIN)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tenant_id", "permission_a", "permission_b")
        verbose_name    = "SoD Rule"
        verbose_name_plural = "SoD Rules"

    def __str__(self):
        tenant = f"tenant:{self.tenant_id}" if self.tenant_id else "global"
        return (
            f"{self.permission_a.code} ≠ {self.permission_b.code} "
            f"[{tenant}] mandatory={self.is_mandatory}"
        )


# ─────────────────────────────────────────────────────────────────────
# 6. ScopeNode + ScopeClosure  (Decision 3)
# ─────────────────────────────────────────────────────────────────────

class ScopeNode(models.Model):
    """
    Registry of all scope objects across Dyuksa.

    Every Workspace, Project, Team, Department that can be used
    as an assignment scope is registered here as a ScopeNode.

    Created automatically via post_save signals when:
        - A Workspace is created
        - A Project is created
        - A Team is created
        - A Department is created (HRMS)

    Signals are in apps/rbac/signals.py and registered in
    apps/rbac/apps.py ready() method.
    """

    scope_type = models.CharField(max_length=20, choices=RoleAssignment.SCOPE_CHOICES)
    scope_id   = models.IntegerField()
    label      = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("scope_type", "scope_id")
        verbose_name    = "Scope Node"
        verbose_name_plural = "Scope Nodes"

    def __str__(self):
        return f"{self.scope_type}:{self.scope_id}"


class ScopeClosure(models.Model):
    """
    Closure table — stores every ancestor-descendant pair in the
    scope hierarchy for O(1) containment checks.  (Decision 3)

    Why a closure table:
        A recursive query to check 'does workspace W contain project P?'
        gets expensive at scale. A closure table pre-computes every
        ancestor-descendant pair so the question becomes a single
        indexed lookup:
            SELECT 1 FROM rbac_scopeclosure
            WHERE ancestor_id = W.node_id AND descendant_id = P.node_id

        This is the Google Zanzibar / Jira pattern for scope containment.

    Example — Workspace W contains Project P which contains Team T:
        (W, W, 0)   self-reference
        (W, P, 1)   workspace is parent of project
        (W, T, 2)   workspace is grandparent of team
        (P, P, 0)   self-reference
        (P, T, 1)   project is parent of team
        (T, T, 0)   self-reference

    Updated via signals in apps/rbac/signals.py:
        Scope created → insert self-reference + ancestor rows
        Scope moved   → delete old closure rows, insert new
        Scope deleted → delete all closure rows for that node
    """

    ancestor   = models.ForeignKey(ScopeNode, on_delete=models.CASCADE, related_name="closure_as_ancestor")
    descendant = models.ForeignKey(ScopeNode, on_delete=models.CASCADE, related_name="closure_as_descendant")
    depth      = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("ancestor", "descendant")
        indexes = [
            models.Index(fields=["ancestor"],   name="rbac_closure_ancestor_idx"),
            models.Index(fields=["descendant"], name="rbac_closure_descendant_idx"),
        ]
        verbose_name        = "Scope Closure"
        verbose_name_plural = "Scope Closures"

    def __str__(self):
        return f"{self.ancestor} → {self.descendant} (depth {self.depth})"