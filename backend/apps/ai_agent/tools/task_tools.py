"""
Task tools — user-scoped queries only.

Every query is filtered to the requesting user.
The agent never returns another user's data.

Changes from v1:
  - get_workspace_members: word-split search + exact-match ranking
  - list_tasks: added offset for pagination
  - Added: delete_task, add_task_comment, get_task_comments
"""
import logging
from django.db.models import Q

logger = logging.getLogger(__name__)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_user_by_email(email: str):
    from apps.users.models import User
    user = User.objects.filter(email=email, is_active=True).first()
    if not user:
        user = User.objects.filter(email=email).first()
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────

TASK_TOOL_SCHEMAS = [
    {
        "name": "list_workspaces",
        "description": (
            "List all workspaces the current user belongs to with their names and IDs. "
            "Use when user asks 'how many workspaces do I have', 'which workspaces am I in', "
            "'list my workspaces', 'show all my workspaces'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
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
        "name": "list_workspaces",
        "description": (
            "List all workspaces the current user belongs to. "
            "Use when user asks 'how many workspaces do I have', "
            "'which workspaces am I in', 'show my workspaces', 'list workspaces'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_workspace_members",
        "description": (
            "Search workspace members by name or email. "
            "Pass an empty search string to list ALL members in the workspace. "
            "Use when user asks: 'who is in my workspace', 'list all members', 'how many members'. "
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
                    "description": "First name, last name, full name, or partial name to search",
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
        "name": "find_task",
        "description": (
            "Find a task by its heading/name when the user does not know the task ID. "
            "ALWAYS call this first when user refers to a task by name instead of ID. "
            "Examples: 'mark Fix login bug as done', 'change priority of Write API docs', "
            "'defer the server migration task'. "
            "Returns task_id which can then be passed to update_task."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "heading": {
                    "type": "string",
                    "description": "The task name or partial name to search for",
                },
                "project_id": {
                    "type": "integer",
                    "description": "Optional: narrow search to a specific project",
                },
            },
            "required": ["heading"],
        },
    },
    {
        "name": "list_tasks",
        "description": (
            "List tasks assigned to or created by the current user. "
            "Use when user asks 'show my tasks', 'what are my open tasks', etc. "
            "Never returns tasks belonging to other users. "
            "Supports pagination via offset — use offset=10 for the next page."
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
                "offset": {
                    "type": "integer",
                    "description": "Number of tasks to skip for pagination (default: 0). Use 10 for next page, 20 for the page after.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max tasks to return (default: 10, max: 50)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "update_task",
        "description": (
            "Update an existing task. Use when user says 'mark task done', "
            "'change priority', 'reassign task', 'update due date', etc. "
            "Status mappings: done→completed, start→in_progress, deploy→deployed, defer→deferred."
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
                "end_date": {"type": "string", "description": "YYYY-MM-DD format"},
                "assigned_to_email": {"type": "string"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "delete_task",
        "description": (
            "Permanently delete a task. "
            "IMPORTANT: Always confirm with the user before calling this. "
            "Only the task creator or assignee can delete a task."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "The ID of the task to delete",
                },
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "add_task_comment",
        "description": (
            "Add a comment to an existing task on behalf of the current user. "
            "Use when user says 'comment on task', 'add a note to task', 'reply to task'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "The ID of the task to comment on",
                },
                "content": {
                    "type": "string",
                    "description": "The comment text",
                },
            },
            "required": ["task_id", "content"],
        },
    },
    {
        "name": "get_task_comments",
        "description": (
            "Get all comments on a task. "
            "Use when user says 'show comments on task', 'what was said about task X'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "The ID of the task",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max comments to return (default: 20)",
                },
            },
            "required": ["task_id"],
        },
    },
]


# ── Executors ─────────────────────────────────────────────────────────────────

def list_workspaces(args: dict, user, workspace_id: str) -> dict:
    """
    Returns all workspaces the current user belongs to.
    """
    try:
        from apps.organizations.models import WorkspaceMembership, Workspace

        memberships = WorkspaceMembership.objects.filter(
            user=user,
        ).select_related("workspace").order_by("workspace__name")

        workspaces = []
        for m in memberships:
            w = m.workspace
            workspaces.append({
                "id":         w.id,
                "name":       w.name,
                "is_current": str(w.id) == str(workspace_id),
                "role":       m.role,
            })

        return {
            "success":    True,
            "count":      len(workspaces),
            "workspaces": workspaces,
        }

    except Exception as exc:
        logger.exception("list_workspaces failed: %s", exc)
        return {"success": False, "error": str(exc)}


def get_workspace_members(args: dict, user, workspace_id: str) -> dict:
    """
    Search members of the CURRENT WORKSPACE only by name or email.
    Never returns users from other workspaces.

    Key fix: splits search term into individual words so 'Shifali Gupta'
    matches first_name='Shifali' and last_name='Gupta' separately.
    Returns exact full-name match alone when found — prevents ambiguity.
    """
    try:
        from apps.users.models import User
        from apps.organizations.models import WorkspaceMembership

        search = args.get("search", "").strip()

        # Step 1 — get IDs of users who belong to this workspace only
        workspace_member_ids = WorkspaceMembership.objects.filter(
            workspace_id=workspace_id,
        ).values_list("user_id", flat=True)

        # Empty search → return ALL workspace members
        if not search:
            all_members = User.objects.filter(
                id__in=workspace_member_ids,
            ).exclude(id=user.id).order_by("first_name")
            members_list = [
                {"name": m.get_full_name() or m.email, "email": m.email, "id": m.id}
                for m in all_members
            ]
            return {
                "success": True,
                "count":   len(members_list),
                "members": members_list,
            }

        # Step 2 — split "Shifali Gupta" → ["Shifali", "Gupta"]
        # and match each word against first_name OR last_name OR email
        search_words = search.strip().split()
        word_filter = Q()
        for word in search_words:
            word_filter |= Q(first_name__icontains=word)
            word_filter |= Q(last_name__icontains=word)
            word_filter |= Q(email__icontains=word)

        qs = User.objects.filter(
            id__in=workspace_member_ids,
            is_active=True,
        ).filter(word_filter).distinct()[:10]

        members_raw = [u for u in qs if u.email]

        if not members_raw:
            return {
                "success": False,
                "error": (
                    f"No workspace member found matching '{search}'. "
                    "They may not be a member of this workspace, or the name may be misspelled."
                ),
            }

        # Step 3 — sort: exact full name match first, then partial, then word match
        search_lower = search.strip().lower()

        def sort_key(u):
            full = u.get_full_name().lower()
            if full == search_lower:
                return 0       # exact — top
            if search_lower in full or full in search_lower:
                return 1       # partial
            return 2           # word match only

        members_raw.sort(key=sort_key)

        members = [
            {"email": u.email, "name": u.get_full_name() or u.email}
            for u in members_raw
        ]

        # If an exact full-name match was found, return only that one
        if sort_key(members_raw[0]) == 0:
            return {"success": True, "count": 1, "members": [members[0]]}

        return {"success": True, "count": len(members), "members": members}

    except Exception as exc:
        logger.exception("get_workspace_members failed: %s", exc)
        return {"success": False, "error": str(exc)}


def list_workspaces(args: dict, user, workspace_id: str) -> dict:
    """
    Returns all workspaces the current user belongs to.
    Queries WorkspaceMembership directly — not scoped to current workspace.
    """
    try:
        from apps.organizations.models import WorkspaceMembership, Workspace

        memberships = WorkspaceMembership.objects.filter(
            user=user,
        ).select_related("workspace").order_by("workspace__name")

        workspaces = [
            {
                "id":   m.workspace.id,
                "name": m.workspace.name,
                "role": m.role,
            }
            for m in memberships
        ]

        return {
            "success":    True,
            "count":      len(workspaces),
            "workspaces": workspaces,
        }

    except Exception as exc:
        logger.exception("list_workspaces failed: %s", exc)
        return {"success": False, "error": str(exc)}


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
            members=user,
        ).distinct()

        if args.get("search"):
            qs = qs.filter(name__icontains=args["search"])

        projects = qs.order_by("name")[:30]

        return {
            "success":  True,
            "count":    qs.count(),
            "projects": [{"id": p.id, "name": p.name} for p in projects],
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

        # Hard guard — verify project exists AND user is a member
        project = Project.objects.filter(
            id=args["project_id"],
            workspace_id=workspace_id,
            is_active=True,
            members=user,
        ).distinct().first()

        if not project:
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

        return {
            "success":      True,
            "task_id":      task.id,
            "heading":      task.heading,
            "status":       task.status,
            "priority":     task.priority,
            "project_name": project.name,
            "assigned_to":  list(task.assigned_to.values_list("email", flat=True)),
        }

    except Exception as exc:
        logger.exception("create_task failed: %s", exc)
        return {"success": False, "error": str(exc)}


def find_task(args: dict, user, workspace_id: str) -> dict:
    """
    Find a task by name so the user never needs to know the task ID.
    Returns the task_id for use in update_task.
    """
    try:
        from apps.tasksite.models import Task

        search = args.get("heading", "").strip()
        if not search:
            return {"success": False, "error": "heading search term is required"}

        qs = Task.objects.filter(
            workspace_id=workspace_id,
        ).filter(
            Q(assigned_to=user) | Q(assigned_by=user)
        ).filter(
            heading__icontains=search
        ).distinct().select_related("project")[:5]

        if not qs.exists():
            return {
                "success": False,
                "error": f"No task found matching '{search}'. Try a different keyword.",
            }

        results = [
            {
                "id":       t.id,
                "heading":  t.heading,
                "status":   t.status,
                "priority": t.priority,
                "project":  t.project.name if t.project else "",
            }
            for t in qs
        ]

        # Single match — return directly so agent can proceed immediately
        if len(results) == 1:
            return {
                "success": True,
                "found":   1,
                "task":    results[0],
                "task_id": results[0]["id"],
            }

        # Multiple matches — return all so agent can ask user to confirm
        return {
            "success": True,
            "found":   len(results),
            "tasks":   results,
            "message": f"Found {len(results)} tasks matching '{search}'. Please confirm which one.",
        }

    except Exception as exc:
        logger.exception("find_task failed: %s", exc)
        return {"success": False, "error": str(exc)}


def list_tasks(args: dict, user, workspace_id: str) -> dict:
    """
    Only returns tasks assigned to OR created by the requesting user.
    Supports offset-based pagination.
    """
    try:
        from apps.ai_agent.access.tasks import get_user_task_queryset, apply_task_filters

        qs = get_user_task_queryset(user, workspace_id)
        qs = apply_task_filters(
            qs,
            user=user,
            status=args.get("status", "pending"),   # chat default: pending
            priority=args.get("priority"),
            project_id=args.get("project_id"),
            updated_today=args.get("updated_today"),
        )

        total_count = qs.count()
        limit  = min(args.get("limit", 10), 50)
        offset = args.get("offset", 0)

        tasks = qs.select_related(
            "assigned_by", "project"
        ).prefetch_related(
            "assigned_to"
        ).order_by("-created_at")[offset: offset + limit]

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
            "offset":   offset,
            "has_more": (offset + limit) < total_count,
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

        task = Task.objects.filter(
            id=args["task_id"],
            workspace_id=workspace_id,
        ).filter(
            Q(assigned_to=user) | Q(assigned_by=user)
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


def delete_task(args: dict, user, workspace_id: str) -> dict:
    """
    Permanently deletes a task.
    Only the creator (assigned_by) or an assignee can delete.
    """
    try:
        from apps.tasksite.models import Task

        task = Task.objects.filter(
            id=args["task_id"],
            workspace_id=workspace_id,
        ).filter(
            Q(assigned_to=user) | Q(assigned_by=user)
        ).distinct().first()

        if not task:
            return {
                "success": False,
                "error": f"Task {args['task_id']} not found or you don't have permission to delete it.",
            }

        heading = task.heading
        task.delete()

        return {
            "success": True,
            "task_id": args["task_id"],
            "heading": heading,
            "message": f"Task '{heading}' has been permanently deleted.",
        }

    except Exception as exc:
        logger.exception("delete_task failed: %s", exc)
        return {"success": False, "error": str(exc)}


def add_task_comment(args: dict, user, workspace_id: str) -> dict:
    """
    Adds a comment to a task on behalf of the current user.
    Task must be accessible to the user (assigned or created by them).
    """
    try:
        from apps.tasksite.models import Task, TaskComment

        task = Task.objects.filter(
            id=args["task_id"],
            workspace_id=workspace_id,
        ).filter(
            Q(assigned_to=user) | Q(assigned_by=user)
        ).distinct().first()

        if not task:
            return {
                "success": False,
                "error": f"Task {args['task_id']} not found or you don't have access to it.",
            }

        content = args.get("content", "").strip()
        if not content:
            return {"success": False, "error": "Comment content cannot be empty."}

        comment = TaskComment.objects.create(
            task=task,
            user=user,
            content=content,
        )

        return {
            "success":    True,
            "comment_id": comment.id,
            "task_id":    task.id,
            "task":       task.heading,
            "content":    comment.content,
            "created_at": str(comment.created_at),
            "message":    f"Comment added to task '{task.heading}'.",
        }

    except Exception as exc:
        logger.exception("add_task_comment failed: %s", exc)
        return {"success": False, "error": str(exc)}


def get_task_comments(args: dict, user, workspace_id: str) -> dict:
    """
    Returns all comments on a task.
    Task must be accessible to the requesting user.
    """
    try:
        from apps.tasksite.models import Task, TaskComment

        task = Task.objects.filter(
            id=args["task_id"],
            workspace_id=workspace_id,
        ).filter(
            Q(assigned_to=user) | Q(assigned_by=user)
        ).distinct().first()

        if not task:
            return {
                "success": False,
                "error": f"Task {args['task_id']} not found or you don't have access to it.",
            }

        limit = min(args.get("limit", 20), 50)
        comments = TaskComment.objects.filter(task=task).select_related("user").order_by("created_at")[:limit]

        return {
            "success":  True,
            "task_id":  task.id,
            "task":     task.heading,
            "total":    TaskComment.objects.filter(task=task).count(),
            "comments": [
                {
                    "id":         c.id,
                    "user":       c.user.get_full_name() or c.user.email,
                    "content":    c.content,
                    "created_at": str(c.created_at),
                }
                for c in comments
            ],
        }

    except Exception as exc:
        logger.exception("get_task_comments failed: %s", exc)
        return {"success": False, "error": str(exc)}