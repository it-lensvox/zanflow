"""
apps/rbac/signals.py

Two responsibilities:

1. Auto-create ScopeNode + ScopeClosure rows when Workspace, Project,
   or Team are created in PM — so the scope hierarchy is always up to date
   without any manual seeding step.

2. Enforce Role inheritance depth limit via pre_save signal — so direct
   ORM .save() calls cannot bypass the clean() validation in models.py.

These signals are connected in RbacConfig.ready() in apps.py.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.core.exceptions import ValidationError


# ─────────────────────────────────────────────────────────────────────
# Role inheritance depth guard — runs on every Role.save()
# ─────────────────────────────────────────────────────────────────────

@receiver(pre_save, sender="rbac.Role")
def enforce_role_inheritance_depth(sender, instance, **kwargs):
    """
    Called before any Role.save() — including direct ORM saves that
    bypass ModelForm.clean(). Prevents circular references and depth > 5.
    """
    if not instance.parent_role_id:
        return

    depth   = 1
    current = instance.parent_role
    visited = {instance.pk} if instance.pk else set()

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
                "Role inheritance cannot exceed 5 levels."
            )
        current = current.parent_role


# ─────────────────────────────────────────────────────────────────────
# Scope auto-registration — runs after Workspace / Project / Team save
# ─────────────────────────────────────────────────────────────────────

def _register_scope_node(scope_type: str, scope_id: int, label: str = ""):
    """
    Create a ScopeNode row for the given scope object if it does not
    already exist. Then insert a self-reference ScopeClosure row at
    depth=0 so containment checks work even for single-level scopes.

    Parent-child closure rows (depth > 0) are inserted by the caller
    when a parent scope is known (e.g. Project knows its Workspace).
    """
    from apps.rbac.models import ScopeNode, ScopeClosure

    node, created = ScopeNode.objects.get_or_create(
        scope_type=scope_type,
        scope_id=scope_id,
        defaults={"label": label},
    )

    # Always ensure the self-reference exists
    ScopeClosure.objects.get_or_create(
        ancestor=node,
        descendant=node,
        defaults={"depth": 0},
    )

    return node, created


def _add_ancestor_closure(child_node, parent_scope_type: str, parent_scope_id: int):
    """
    Add closure rows linking every ancestor of the parent scope to the
    child node. Called after a Project (child) is created inside a
    Workspace (parent).

    For each existing ancestor A of parent with depth D:
        Insert (A, child_node, D+1)
    """
    from apps.rbac.models import ScopeNode, ScopeClosure

    try:
        parent_node = ScopeNode.objects.get(
            scope_type=parent_scope_type,
            scope_id=parent_scope_id,
        )
    except ScopeNode.DoesNotExist:
        return

    # Get all ancestor rows for the parent (including self at depth 0)
    ancestor_rows = ScopeClosure.objects.filter(descendant=parent_node)

    for row in ancestor_rows:
        ScopeClosure.objects.get_or_create(
            ancestor=row.ancestor,
            descendant=child_node,
            defaults={"depth": row.depth + 1},
        )


# ── Workspace signal ──────────────────────────────────────────────────

@receiver(post_save, sender="organizations.Workspace")
def on_workspace_created(sender, instance, created, **kwargs):
    """
    Registers a new Workspace as a scope node when it is first created.
    Workspaces sit under Organization in the hierarchy — but for Phase A
    we treat Workspace as the top-level PM scope. Organization-level
    closure rows are added when/if the Organization scope is needed.
    """
    if not created:
        return
    try:
        _register_scope_node(
            scope_type="workspace",
            scope_id=instance.pk,
            label=instance.name,
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            "rbac: Failed to register workspace scope node pk=%s: %s",
            instance.pk, e
        )


# ── Project signal ────────────────────────────────────────────────────

@receiver(post_save, sender="projects.Project")
def on_project_created(sender, instance, created, **kwargs):
    """
    Registers a new Project as a scope node and adds closure rows linking
    it to its parent Workspace.

    After this signal:
        (Workspace W, Project P, depth=1)  exists in ScopeClosure
        (Project P,   Project P, depth=0)  exists in ScopeClosure
    So a HR Executive assigned at Workspace W can be checked against
    Project P in a single indexed lookup.
    """
    if not created:
        return
    try:
        node, _ = _register_scope_node(
            scope_type="project",
            scope_id=instance.pk,
            label=getattr(instance, "name", ""),
        )
        # Link to parent workspace if available
        if hasattr(instance, "workspace_id") and instance.workspace_id:
            _add_ancestor_closure(
                child_node=node,
                parent_scope_type="workspace",
                parent_scope_id=instance.workspace_id,
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            "rbac: Failed to register project scope node pk=%s: %s",
            instance.pk, e
        )


# ── Team signal ───────────────────────────────────────────────────────

@receiver(post_save, sender="teams.Team")
def on_team_created(sender, instance, created, **kwargs):
    """
    Registers a new Team as a scope node. Teams sit under Projects
    or directly under Workspaces depending on how they are created.
    """
    if not created:
        return
    try:
        node, _ = _register_scope_node(
            scope_type="team",
            scope_id=instance.pk,
            label=getattr(instance, "name", ""),
        )
        # Link to parent project if available
        if hasattr(instance, "project_id") and instance.project_id:
            _add_ancestor_closure(
                child_node=node,
                parent_scope_type="project",
                parent_scope_id=instance.project_id,
            )
        # Link to parent workspace if available (team directly under workspace)
        elif hasattr(instance, "workspace_id") and instance.workspace_id:
            _add_ancestor_closure(
                child_node=node,
                parent_scope_type="workspace",
                parent_scope_id=instance.workspace_id,
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            "rbac: Failed to register team scope node pk=%s: %s",
            instance.pk, e
        )

# ── User auto-provisioning signal ────────────────────────────────────

@receiver(post_save, sender="users.User")
def on_user_created(sender, instance, created, **kwargs):
    """
    Auto-assign default platform roles when a new user is created.

    Fires for every user creation path:
      - Invite acceptance  (AcceptInvitationView)
      - Direct creation    (UserCreateView — admin adds user)
      - OAuth signup       (SocialAuthView)

    What gets assigned:
      - hrms → employee   (basic HRMS access for all new users)

    The org founder gets hr_admin via the setup_hrms management command.
    Regular users start as employee — HR Admin upgrades them as needed.

    Safe:
      - Wrapped in try/except so user creation never fails
      - get_or_create prevents duplicate assignments
      - Only fires on created=True (not on every user.save())
    """
    if not created:
        return

    if not instance.organization_id:
        return  # superuser or system user — skip

    try:
        from apps.rbac.models import Role, RoleAssignment
        from apps.organizations.models import PlatformAccess
        from django.utils import timezone

        today = timezone.now().date()
        org_id = instance.organization_id

        # Only assign roles for platforms this org has access to
        active_platforms = set(
            PlatformAccess.objects.filter(
                organization_id     = org_id,
                is_active           = True,
                platform__is_active = True,
            ).values_list("platform__key", flat=True)
        )

        # Default role per platform for all new users
        default_roles = {
            "hrms": "employee",
        }

        for platform_key, role_code in default_roles.items():
            if platform_key not in active_platforms:
                continue  # org does not have this platform

            # Find the template role (tenant_id=None = Dyuksa template)
            role = Role.objects.filter(
                tenant_id = None,
                code      = role_code,
                platform  = platform_key,
            ).first()

            if not role:
                continue  # role not seeded yet — skip silently

            # Create assignment — skip if already exists
            RoleAssignment.objects.get_or_create(
                user_id    = instance.pk,
                role       = role,
                platform   = platform_key,
                scope_type = "organization",
                scope_id   = org_id,
                defaults   = {
                    "valid_from":   today,
                    "valid_to":     None,
                    "assigned_by":  None,
                },
            )

    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            "rbac: Failed to auto-assign platform roles for user pk=%s: %s",
            instance.pk, e
        )