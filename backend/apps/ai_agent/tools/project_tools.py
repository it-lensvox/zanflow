"""
Project tools — user-scoped queries only.
Only returns projects the requesting user is a member of.
"""
import logging

logger = logging.getLogger(__name__)

PROJECT_TOOL_SCHEMAS = [
    {
        "name": "list_projects",
        "description": (
            "List projects the current user is a member of. "
            "Use when user asks 'show my projects', 'what projects do I have', etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max results (default: 10)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_project_summary",
        "description": (
            "Get a summary of a specific project the user is a member of, "
            "including task counts. Use when user asks about a specific project."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "integer",
                    "description": "The ID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
]


def list_projects(args: dict, user, workspace_id: str) -> dict:
    try:
        from apps.projects.models import Project

        # User-scoped — only projects user is a member of
        qs = Project.objects.filter(
            workspace_id=workspace_id,
            is_active=True,
            members=user,           # ← user-scoped
        ).distinct()

        limit = min(args.get("limit", 10), 50)
        projects = qs.order_by("name")[:limit]

        total_count = qs.count()
        projects_list = [{"id": p.id, "name": p.name} for p in projects]

        return {
            "success":  True,
            "total":    total_count,
            "returned": len(projects_list),
            "has_more": total_count > limit,
            "projects": projects_list,
        }

    except Exception as exc:
        logger.exception("list_projects failed: %s", exc)
        return {"success": False, "error": str(exc)}


def get_project_summary(args: dict, user, workspace_id: str) -> dict:
    try:
        from apps.projects.models import Project

        # User-scoped — can only view projects they are a member of
        project = Project.objects.filter(
            id=args["project_id"],
            workspace_id=workspace_id,
            is_active=True,
            members=user,           # ← user-scoped
        ).distinct().first()

        if not project:
            return {
                "success": False,
                "error": "Project not found or you are not a member of it.",
            }

        task_counts = {}
        try:
            from apps.tasksite.models import Task
            from django.db.models import Q
            tasks = Task.objects.filter(
                project=project,
                workspace_id=workspace_id,
            ).filter(
                Q(assigned_to=user) | Q(assigned_by=user)
            ).distinct()
            task_counts = {
                "total":       tasks.count(),
                "open":        tasks.filter(status="open").count(),
                "in_progress": tasks.filter(status="in_progress").count(),
                "done":        tasks.filter(status="done").count(),
            }
        except Exception:
            pass

        return {
            "success": True,
            "project": {
                "id":          project.id,
                "name":        project.name,
                "description": project.description or "",
                "task_counts": task_counts,
            },
        }

    except Exception as exc:
        logger.exception("get_project_summary failed: %s", exc)
        return {"success": False, "error": str(exc)}