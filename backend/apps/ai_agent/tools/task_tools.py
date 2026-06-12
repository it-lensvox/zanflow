"""
Task tools — user-scoped queries only.

Every query is filtered to the requesting user.
The agent never returns another user's data.
"""
import logging
from django.db.models import Q

logger = logging.getLogger(__name__)


def _get_user_by_email(email: str):
    from apps.users.models import User
    user = User.objects.filter(email=email, is_active=True).first()
    if not user:
        user = User.objects.filter(email=email).first()
    return user


def get_workspace_members(args: dict, user, workspace_id: str) -> dict:
    """
    Search members of the CURRENT WORKSPACE only by name or email.
    Never returns users from other workspaces.
    Used by the agent to resolve a person's name to their email before assigning tasks.
    """
    try:
        from apps.users.models import User
        from apps.organizations.models import WorkspaceMembership

        search = args.get("search", "").strip()
        if not search:
            return {"success": False, "error": "search term is required"}

        # Step 1 — get IDs of users who belong to this workspace only
        workspace_member_ids = WorkspaceMembership.objects.filter(
            workspace_id=workspace_id,
        ).values_list("user_id", flat=True)

        # Step 2 — filter those users by the search term
        qs = User.objects.filter(
            id__in=workspace_member_ids,
            is_active=True,
        ).filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search)  |
            Q(email__icontains=search)
        ).distinct()[:10]

        members = [
            {
                "email": u.email,
                "name":  u.get_full_name() or u.email,
            }
            for u in qs
            if u.email
        ]

        if not members:
            return {
                "success": False,
                "error": (
                    f"No workspace member found matching '{search}'. "
                    "They may not be a member of this workspace, or the name may be misspelled."
                ),
            }

        return {
            "success": True,
            "count":   len(members),
            "members": members,
        }

    except Exception as exc:
        logger.exception("get_workspace_members failed: %s", exc)
        return {"success": False, "error": str(exc)}


TASK_TOOL_SCHEMAS = [
    {
        "name": "get_user_projects",
        "description": (
            "Fetch projects the current user is a member of. "
            "ALWAYS call this before create_task if the user has not mentioned "
            "a specific project. Show the list and ask which project to use."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Optional: filter projects by name keyword",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_workspace_members",
        "description": (
            "Search workspace members by name or email to get their email address. "
            "YOU MUST call this as the FIRST tool call whenever the user mentions "
            "any person's name (not email) in the context of assigning a task. "
            "Call this BEFORE get_user_projects and BEFORE create_task. "
            "Example: 'assign to Shifali Gupta' → call get_workspace_members(search='Shifali Gupta') first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "First name, last name, or partial name to search",
                },
            },
            "required": ["search"],
        },
    },
    {
        "name": "create_task",
        "description": (
            "Create a new task. "
            "REQUIRED BEFORE CALLING: "
            "(1) If assigning by name → get_workspace_members must be called first to get email. "
            "(2) project_id is required → get_user_projects must be called first if unknown. "
            "Never call create_task as the first tool when a person name is mentioned."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "heading": {
                    "type": "string",
                    "description": "The task heading / title",
                },
                "project_id": {
                    "type": "integer",
                    "description": "REQUIRED. The ID of the project this task belongs to.",
                },
                "description": {
                    "type": "string",
                    "description": "Optional longer description",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
                    "description": "Task priority (default: medium)",
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format (optional)",
                },
                "end_date": {
                    "type": "string",
                    "description": "End/due date in YYYY-MM-DD format (optional)",
                },
                "assigned_to_email": {
                    "type": "string",
                    "description": "Email of user to assign task to (optional)",
                },
                "status": {
                    "type": "string",
                    "enum": ["pending", "backlog", "in_progress", "review", "completed", "deployed", "deferred"],
                    "description": "Initial status (default: pending)",
                },
            },
            "required": ["heading", "project_id"],
        },
    },
    {
        "name": "list_tasks",
        "description": (
            "List tasks assigned to or created by the current user. "
            "Use when user asks 'show my tasks', 'what are my open tasks', etc. "
            "Never returns tasks belonging to other users."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["pending", "backlog", "in_progress", "review", "completed", "deployed", "deferred", "all"],
                    "description": "Filter by status (default: pending)",
                },
                "project_id": {
                    "type": "integer",
                    "description": "Filter by project ID (optional)",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
                    "description": "Filter by priority (optional)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max tasks to return (default: 10)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "update_task",
        "description": (
            "Update an existing task. Use when user says 'mark task done', "
            "'change priority', 'reassign task', 'update due date', etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "The ID of the task to update",
                },
                "heading": {"type": "string"},
                "status": {
                    "type": "string",
                    "enum": ["pending", "backlog", "in_progress", "review", "completed", "deployed", "deferred"],
                    "description": "New status for the task",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
                },
                "end_date": {"type": "string"},
                "assigned_to_email": {"type": "string"},
            },
            "required": ["task_id"],
        },
    },
]


# ── Executors ─────────────────────────────────────────────────────────────────

def get_user_projects(args: dict, user, workspace_id: str) -> dict:
    """
    Returns only projects the requesting user is a member of.
    Never returns other users' projects.
    """
    try:
        from apps.projects.models import Project

        qs = Project.objects.filter(
            workspace_id=workspace_id,
            is_active=True,
            members=user,           # ← user-scoped
        ).distinct()

        if args.get("search"):
            qs = qs.filter(name__icontains=args["search"])

        projects = qs.order_by("name")[:30]

        return {
            "success": True,
            "count":   qs.count(),
            "projects": [
                {"id": p.id, "name": p.name}
                for p in projects
            ],
        }

    except Exception as exc:
        logger.exception("get_user_projects failed: %s", exc)
        return {"success": False, "error": str(exc)}


def create_task(args: dict, user, workspace_id: str) -> dict:
    try:
        from apps.tasksite.models import Task
        from apps.projects.models import Project

        if not args.get("project_id"):
            return {
                "success": False,
                "error": "project_id is required.",
                "action_required": "ask_project",
            }

        # Hard guard — verify the project exists AND user is a member
        # This prevents the LLM from guessing a wrong project_id
        project = Project.objects.filter(
            id=args["project_id"],
            workspace_id=workspace_id,
            is_active=True,
            members=user,
        ).distinct().first()

        if not project:
            # Fetch actual projects so agent can show correct options
            valid_projects = list(
                Project.objects.filter(
                    workspace_id=workspace_id,
                    is_active=True,
                    members=user,
                ).distinct().values("id", "name").order_by("name")[:30]
            )
            return {
                "success": False,
                "error": (
                    f"Project ID {args['project_id']} does not exist or "
                    "you are not a member of it."
                ),
                "action_required": "ask_project",
                "available_projects": valid_projects,
            }

        payload = {
            "heading":      args["heading"],
            "description":  args.get("description", ""),
            "priority":     args.get("priority", "medium"),
            "status":       args.get("status", "pending"),
            "assigned_by":  user,
            "workspace_id": workspace_id,
            "project_id":   args["project_id"],
        }

        try:
            payload["organization_id"] = user.organization_id
        except AttributeError:
            pass

        if args.get("start_date"):
            payload["start_date"] = args["start_date"]
        if args.get("end_date"):
            payload["end_date"] = args["end_date"]

        task = Task.objects.create(**payload)

        if args.get("assigned_to_email"):
            assignee = _get_user_by_email(args["assigned_to_email"])
            if assignee:
                task.assigned_to.add(assignee)

        project_name = ""
        try:
            project_name = task.project.name
        except Exception:
            pass

        return {
            "success":      True,
            "task_id":      task.id,
            "heading":      task.heading,
            "status":       task.status,
            "priority":     task.priority,
            "project_name": project_name,
            "assigned_to":  list(task.assigned_to.values_list("email", flat=True)),
        }

    except Exception as exc:
        logger.exception("create_task failed: %s", exc)
        return {"success": False, "error": str(exc)}


def list_tasks(args: dict, user, workspace_id: str) -> dict:
    """
    Only returns tasks assigned to OR created by the requesting user.
    Never leaks another user's tasks.
    """
    try:
        from apps.tasksite.models import Task

        # User-scoped — only MY tasks
        qs = Task.objects.filter(
            workspace_id=workspace_id,
        ).filter(
            Q(assigned_to=user) | Q(assigned_by=user)  # ← user-scoped
        ).distinct()

        status_filter = args.get("status", "pending")
        if status_filter != "all":
            qs = qs.filter(status=status_filter)

        if args.get("priority"):
            qs = qs.filter(priority=args["priority"])

        if args.get("project_id"):
            qs = qs.filter(project_id=args["project_id"])

        limit = min(args.get("limit", 10), 50)

        total_count = qs.count()

        tasks = qs.select_related(
            "assigned_by", "project"
        ).prefetch_related(
            "assigned_to"
        ).order_by("-created_at")[:limit]

        tasks_list = [
            {
                "id":          t.id,
                "heading":     t.heading,
                "status":      t.status,
                "priority":    t.priority,
                "end_date":    str(t.end_date) if t.end_date else None,
                "assigned_to": list(t.assigned_to.values_list("email", flat=True)),
                "project":     t.project.name if t.project else None,
            }
            for t in tasks
        ]

        return {
            "success":  True,
            "total":    total_count,
            "returned": len(tasks_list),
            "has_more": total_count > limit,
            "tasks":    tasks_list,
        }

    except Exception as exc:
        logger.exception("list_tasks failed: %s", exc)
        return {"success": False, "error": str(exc)}


def update_task(args: dict, user, workspace_id: str) -> dict:
    """
    Only allows updating tasks the user owns or is assigned to.
    """
    try:
        from apps.tasksite.models import Task

        # User-scoped — can only update tasks they are part of
        task = Task.objects.filter(
            id=args["task_id"],
            workspace_id=workspace_id,
        ).filter(
            Q(assigned_to=user) | Q(assigned_by=user)  # ← user-scoped
        ).distinct().first()

        if not task:
            return {
                "success": False,
                "error": f"Task {args['task_id']} not found or you don't have access to it.",
            }

        simple_fields = ["heading", "status", "priority", "end_date", "start_date"]
        changed = []
        for field in simple_fields:
            if field in args:
                setattr(task, field, args[field])
                changed.append(field)

        if "status" in args:
            task.status_updated_by = user
            if "status_updated_by" not in changed:
                changed.append("status_updated_by")

        if changed:
            task.save(update_fields=changed)

        if args.get("assigned_to_email"):
            assignee = _get_user_by_email(args["assigned_to_email"])
            if assignee:
                task.assigned_to.add(assignee)
            else:
                return {"success": False, "error": f"User {args['assigned_to_email']} not found"}

        return {
            "success":  True,
            "task_id":  task.id,
            "heading":  task.heading,
            "status":   task.status,
            "priority": task.priority,
            "message":  f"Task '{task.heading}' updated successfully",
        }

    except Exception as exc:
        logger.exception("update_task failed: %s", exc)
        return {"success": False, "error": str(exc)}