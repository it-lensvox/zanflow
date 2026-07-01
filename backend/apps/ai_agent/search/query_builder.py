"""
apps/ai_agent/search/query_builder.py

Converts extracted filter dict → Django ORM querysets.

Rules (non-negotiable):
  - Always workspace-scoped
  - Always user-scoped (only data the user owns or is assigned to)
  - No raw SQL ever
  - Max 10 results per model (performance)
  - Every model query wrapped in try/except so one failure never breaks others
"""
import logging
from datetime import date
from django.db.models import Q

logger = logging.getLogger(__name__)

# ── Task ───────────────────────────────────────────────────────────────────────

def _search_tasks(filters: dict, user, workspace_id: str, limit: int = 10, offset: int = 0) -> tuple:
    """Returns (results_list, total_count)"""
    try:
        from apps.ai_agent.access.tasks import get_user_task_queryset

        qs = get_user_task_queryset(user, workspace_id)

        if filters.get("search_text"):
            t = filters["search_text"]
            qs = qs.filter(
                Q(heading__icontains=t) | Q(description__icontains=t)
            )

        if filters.get("status"):
            qs = qs.filter(status=filters["status"])

        if filters.get("priority"):
            qs = qs.filter(priority=filters["priority"])

        if filters.get("overdue") is True:
            qs = qs.filter(
                end_date__lt=date.today(),
                status__in=["pending", "in_progress", "review", "backlog"],
            )

        if filters.get("assigned_to_me") is True:
            qs = qs.filter(assigned_to=user)

        if filters.get("assignee_name"):
            name = filters["assignee_name"]
            qs = qs.filter(
                Q(assigned_to__first_name__icontains=name) |
                Q(assigned_to__last_name__icontains=name)
            ).distinct()

        if filters.get("project_name"):
            qs = qs.filter(project__name__icontains=filters["project_name"])

        total = qs.count()
        page_qs = qs.order_by("-updated_at")[offset: offset + limit]
        return [
            {
                "id":          t.id,
                "heading":     t.heading,
                "status":      t.status,
                "priority":    t.priority,
                "project":     t.project.name if t.project else None,
                "assigned_to": [
                    u.get_full_name() or u.email
                    for u in t.assigned_to.all()
                ],
                "end_date": str(t.end_date.date()) if t.end_date else None,
            }
            for t in page_qs
        ], total

    except Exception as exc:
        logger.warning("Task search failed: %s", exc)
        return [], 0


# ── Note ───────────────────────────────────────────────────────────────────────

def _search_notes(filters: dict, user, workspace_id: str, limit: int = 10, offset: int = 0) -> tuple:
    """Returns (results_list, total_count)"""
    try:
        from apps.quicknotes.models import Note

        qs = Note.objects.filter(
            workspace_id=workspace_id,
            user=user,
        )

        if filters.get("search_text"):
            t = filters["search_text"]
            qs = qs.filter(
                Q(title__icontains=t) | Q(content__icontains=t)
            )

        if filters.get("project_name"):
            qs = qs.filter(
                project__name__icontains=filters["project_name"]
            )

        total = qs.count()
        page_qs = qs.order_by("-updated_at")[offset: offset + limit]
        return [
            {
                "id":      n.id,
                "title":   getattr(n, "title", ""),
                "preview": str(getattr(n, "content", ""))[:150],
                "project": n.project.name if getattr(n, "project", None) else None,
            }
            for n in page_qs
        ], total

    except Exception as exc:
        logger.warning("Note search failed: %s", exc)
        return [], 0


# ── Project ─────────────────────────────────────────────────────────────────────

def _search_projects(filters: dict, user, workspace_id: str, limit: int = 10, offset: int = 0) -> tuple:
    """Returns (results_list, total_count)"""
    try:
        from apps.ai_agent.access.projects import get_user_project_queryset

        qs = get_user_project_queryset(user, workspace_id)

        # Favourites filter
        if filters.get("is_favourite") is True:
            qs = qs.filter(favorited_by=user)

        keyword = filters.get("project_name") or filters.get("search_text")
        if keyword:
            qs = qs.filter(
                Q(name__icontains=keyword) | Q(description__icontains=keyword)
            )

        total = qs.count()
        page_qs = qs.order_by("name")[offset: offset + limit]
        return [
            {
                "id":           p.id,
                "name":         p.name,
                "description":  p.description,
                "is_favourite": p.favorited_by.filter(id=user.id).exists(),
            }
            for p in page_qs
        ], total

    except Exception as exc:
        logger.warning("Project search failed: %s", exc)
        return [], 0


# ── Event ──────────────────────────────────────────────────────────────────────

def _search_events(filters: dict, user, workspace_id: str, limit: int = 10, offset: int = 0) -> tuple:
    """Returns (results_list, total_count)"""
    try:
        from apps.ai_agent.access.events import get_user_event_queryset
        from datetime import datetime, date
        import pytz

        # Events scoped to organizer OR attendee
        qs = get_user_event_queryset(user, workspace_id)

        # Keyword search
        if filters.get("search_text"):
            t = filters["search_text"]
            qs = qs.filter(
                Q(title__icontains=t) | Q(description__icontains=t)
            )

        # Today filter
        if filters.get("today") is True:
            today = date.today()
            qs = qs.filter(
                start_time__date=today
            )

        # Date range filter
        if filters.get("date"):
            qs = qs.filter(start_time__date=filters["date"])

        total = qs.count()
        page_qs = qs.order_by("start_time")[offset: offset + limit]
        return [
            {
                "id":          e.id,
                "title":       e.title,
                "event_type":  e.event_type,
                "start_time":  str(e.start_time),
                "end_time":    str(e.end_time),
                "location":    e.location,
                "is_online":   e.is_online_meeting,
                "organizer":   e.organizer.get_full_name() or e.organizer.email,
            }
            for e in page_qs
        ], total

    except Exception as exc:
        logger.warning("Event search failed: %s", exc)
        return [], 0


# ── Document ───────────────────────────────────────────────────────────────────

def _search_documents(filters: dict, user, workspace_id: str, limit: int = 10, offset: int = 0) -> tuple:
    """
    Returns (results_list, total_count)
    Uses the SAME shared access function as chat's list_documents tool —
    apps.ai_agent.access.documents — guaranteeing identical visibility
    rules between chat and search for documents.
    """
    try:
        from apps.ai_agent.access.documents import get_user_document_queryset

        qs = get_user_document_queryset(user, workspace_id)

        # Project filter — same project_name → ID matching style used elsewhere
        if filters.get("project_name"):
            qs = qs.filter(project__name__icontains=filters["project_name"])

        # Keyword search
        if filters.get("search_text"):
            qs = qs.filter(name__icontains=filters["search_text"])

        total = qs.count()
        page_qs = qs.select_related("project").order_by("-created_at")[offset: offset + limit]
        return [
            {
                "id":         str(d.id),
                "name":       d.name,
                "project":    d.project.name if d.project else None,
                "status":     d.status,
                "file_type":  d.file_type,
            }
            for d in page_qs
        ], total

    except Exception as exc:
        logger.warning("Document search failed: %s", exc)
        return [], 0


# ── Public API ──────────────────────────────────────────────────────────────────

def _resolve_project_id(project_name: str, user, workspace_id: str):
    """
    Resolves a project name to its ID — used only for filters_used in the
    API response so frontend gets an unambiguous project_id (like the chat
    agent already does), instead of a raw name string.
    Does NOT change how tasks/notes/projects are actually filtered below —
    those still match by name exactly as before. Read-only lookup, fails
    silently to None if not found.
    """
    try:
        from apps.projects.models import Project
        project = Project.objects.filter(
            workspace_id=workspace_id,
            members=user,
            name__icontains=project_name,
        ).values("id").first()
        return project["id"] if project else None
    except Exception as exc:
        logger.warning("Project ID resolution failed: %s", exc)
        return None


def run_search(filters: dict, user, workspace_id: str,
               page: int = 1, page_size: int = 10) -> dict:
    """
    Runs ORM queries for the requested models with pagination.
    Returns a dict ready for the API response.
    Each model query is independent — one failure never blocks others.
    """
    models  = filters.get("models") or ["task", "note", "project", "event", "document"]
    offset  = (page - 1) * page_size
    results = {"tasks": [], "notes": [], "projects": [], "events": [], "documents": []}
    totals  = {"tasks": 0,  "notes": 0,  "projects": 0,  "events": 0,  "documents": 0}

    # Resolve project_name → project_id for filters_used (read-only, additive)
    resolved_project_id = None
    if filters.get("project_name"):
        resolved_project_id = _resolve_project_id(filters["project_name"], user, workspace_id)

    if "task" in models:
        results["tasks"], totals["tasks"] = _search_tasks(
            filters, user, workspace_id, limit=page_size, offset=offset)

    if "note" in models:
        results["notes"], totals["notes"] = _search_notes(
            filters, user, workspace_id, limit=page_size, offset=offset)

    if "project" in models:
        results["projects"], totals["projects"] = _search_projects(
            filters, user, workspace_id, limit=page_size, offset=offset)

    if "event" in models:
        results["events"], totals["events"] = _search_events(
            filters, user, workspace_id, limit=page_size, offset=offset)

    if "document" in models:
        results["documents"], totals["documents"] = _search_documents(
            filters, user, workspace_id, limit=page_size, offset=offset)

    total    = sum(totals.values())
    has_more = any(
        totals[m] > offset + page_size
        for m in ["tasks", "notes", "projects", "events", "documents"]
    )

    return {
        "results":             results,
        "totals":              totals,
        "total":               total,
        "page":                page,
        "page_size":           page_size,
        "has_more":            has_more,
        "resolved_project_id": resolved_project_id,
    }