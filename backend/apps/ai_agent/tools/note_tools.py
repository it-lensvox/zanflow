"""
Note tools — user-scoped queries only.
Only returns notes created by the requesting user.
"""
import logging

logger = logging.getLogger(__name__)

NOTE_TOOL_SCHEMAS = [
    {
        "name": "create_note",
        "description": (
            "Create a new note for the current user. "
            "Use when user says 'add a note', 'save this', 'note that', etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Short title for the note",
                },
                "content": {
                    "type": "string",
                    "description": "The body/content of the note",
                },
                "project_id": {
                    "type": "integer",
                    "description": "Link this note to a project (optional)",
                },
            },
            "required": ["title", "content"],
        },
    },
    {
        "name": "list_notes",
        "description": (
            "List or search notes created by the current user only. "
            "Use when user says 'show my notes', 'find notes about X', etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Keyword to search in note titles and content",
                },
                "project_id": {
                    "type": "integer",
                    "description": "Filter notes by project",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max notes to return (default: 10)",
                },
            },
            "required": [],
        },
    },
]

_NOTE_FIELDS = None

def _get_note_model():
    import apps.quicknotes.models as qn_models
    import django.db.models as django_models
    for attr_name in dir(qn_models):
        obj = getattr(qn_models, attr_name)
        try:
            if (
                isinstance(obj, type)
                and issubclass(obj, django_models.Model)
                and not obj._meta.abstract
                and obj.__module__ == qn_models.__name__
                and attr_name == "Note"
            ):
                return obj
        except Exception:
            continue
    raise ImportError("Could not find Note model in apps.quicknotes.models")

def _note_fields() -> set:
    global _NOTE_FIELDS
    if _NOTE_FIELDS is None:
        Note = _get_note_model()
        _NOTE_FIELDS = {f.name for f in Note._meta.get_fields() if hasattr(f, "column")}
    return _NOTE_FIELDS


def create_note(args: dict, user, workspace_id: str) -> dict:
    try:
        from apps.organizations.models import Workspace
        Note = _get_note_model()

        # Note is a TenantModel — must explicitly set organization_id and workspace_id
        # Cannot rely on request context since agent runs outside normal request cycle
        workspace = Workspace.objects.filter(id=workspace_id).select_related("organization").first()
        if not workspace:
            return {"success": False, "error": f"Workspace {workspace_id} not found."}

        organization_id = workspace.organization_id

        # title is optional — auto-generate from content if not provided
        title = args.get("title", "").strip()
        if not title:
            content_preview = args.get("content", "")[:50]
            title = (content_preview + "...") if len(args.get("content", "")) > 50 else content_preview or "Untitled"

        note = Note(
            title=title,
            content=args.get("content", ""),
            user=user,
            workspace_id=workspace_id,
            organization_id=organization_id,
        )

        if args.get("project_id"):
            note.project_id = args["project_id"]

        note.save()

        return {
            "success":  True,
            "note_id":  note.id,
            "title":    note.title,
            "message":  f"Note '{note.title}' created successfully",
        }

    except Exception as exc:
        logger.exception("create_note failed: %s", exc)
        return {"success": False, "error": str(exc)}


def list_notes(args: dict, user, workspace_id: str) -> dict:
    try:
        from django.db.models import Q
        Note = _get_note_model()
        fields = _note_fields()

        # User-scoped — Note model uses 'user' FK (confirmed from models.py)
        # Fallback chain handles other model variants too
        if "user" in fields and "workspace_id" in fields:
            qs = Note.objects.filter(workspace_id=workspace_id, user=user)
        elif "user" in fields:
            qs = Note.objects.filter(user=user)
        elif "workspace_id" in fields and ("created_by_id" in fields or "created_by" in fields):
            qs = Note.objects.filter(workspace_id=workspace_id, created_by=user)
        elif "workspace_id" in fields:
            qs = Note.objects.filter(workspace_id=workspace_id)
        else:
            qs = Note.objects.filter(user=user)

        if args.get("search"):
            q = Q()
            if "title" in fields:
                q |= Q(title__icontains=args["search"])
            if "content" in fields:
                q |= Q(content__icontains=args["search"])
            if q:
                qs = qs.filter(q)

        if args.get("project_id") and "project_id" in fields:
            qs = qs.filter(project_id=args["project_id"])

        limit = min(args.get("limit", 10), 50)
        notes = qs.order_by("-created_at")[:limit]

        results = []
        for n in notes:
            title   = getattr(n, "title",   None) or getattr(n, "heading", "Untitled")
            content = getattr(n, "content", None) or getattr(n, "body",    "")
            results.append({
                "id":         n.id,
                "title":      title,
                "preview":    str(content)[:200] if content else "",
                "created_at": str(n.created_at.date()) if hasattr(n, "created_at") else "",
            })

        total_count = qs.count()
        return {
            "success":  True,
            "total":    total_count,
            "returned": len(results),
            "has_more": total_count > limit,
            "notes":    results,
        }

    except Exception as exc:
        logger.exception("list_notes failed: %s", exc)
        return {"success": False, "error": str(exc)}