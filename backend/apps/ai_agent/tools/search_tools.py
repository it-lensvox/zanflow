"""
Search tools — user-scoped queries only.
Search only returns content belonging to the requesting user.
"""
import logging
from django.db.models import Q

logger = logging.getLogger(__name__)

SEARCH_TOOL_SCHEMAS = [
    {
        "name": "search_workspace",
        "description": (
            "Search across the current user's tasks, notes, and projects. "
            "Only returns content the user owns or is assigned to. "
            "Use when user says 'find', 'search for', 'look up', 'where is X'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search term or phrase",
                },
                "content_types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["tasks", "notes", "projects"],
                    },
                    "description": "Which content types to search. Defaults to all.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results per content type (default: 5)",
                },
            },
            "required": ["query"],
        },
    },
]


def search_workspace(args: dict, user, workspace_id: str) -> dict:
    query = args.get("query", "").strip()
    if not query:
        return {"success": False, "error": "Search query cannot be empty"}

    content_types = args.get("content_types", ["tasks", "notes", "projects"])
    limit = min(args.get("limit", 5), 20)
    results = {}

    if "tasks" in content_types:
        try:
            from apps.tasksite.models import Task
            tasks = Task.objects.filter(
                workspace_id=workspace_id,
            ).filter(
                Q(assigned_to=user) | Q(assigned_by=user)  # ← user-scoped
            ).filter(
                Q(heading__icontains=query) | Q(description__icontains=query)
            ).distinct().order_by("-created_at")[:limit]

            results["tasks"] = [
                {
                    "id":      t.id,
                    "heading": t.heading,
                    "status":  t.status,
                    "project": t.project.name if t.project else None,
                }
                for t in tasks
            ]
        except Exception as exc:
            logger.warning("Task search failed: %s", exc)
            results["tasks"] = []

    if "notes" in content_types:
        try:
            import apps.quicknotes.models as qn_models
            Note = getattr(qn_models, "Note", None)
            if Note:
                notes = Note.objects.filter(
                    workspace_id=workspace_id,
                    created_by=user,            # ← user-scoped
                ).filter(
                    Q(title__icontains=query) | Q(content__icontains=query)
                ).order_by("-created_at")[:limit]

                results["notes"] = [
                    {
                        "id":      n.id,
                        "title":   getattr(n, "title", ""),
                        "preview": str(getattr(n, "content", ""))[:150],
                    }
                    for n in notes
                ]
        except Exception as exc:
            logger.warning("Note search failed: %s", exc)
            results["notes"] = []

    if "projects" in content_types:
        try:
            from apps.projects.models import Project
            projects = Project.objects.filter(
                workspace_id=workspace_id,
                members=user,                   # ← user-scoped
            ).filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            ).distinct().order_by("name")[:limit]

            results["projects"] = [
                {"id": p.id, "name": p.name}
                for p in projects
            ]
        except Exception as exc:
            logger.warning("Project search failed: %s", exc)
            results["projects"] = []

    total = sum(len(v) for v in results.values())
    return {
        "success":       True,
        "query":         query,
        "total_results": total,
        "results":       results,
    }