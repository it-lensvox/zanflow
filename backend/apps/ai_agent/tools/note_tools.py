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
            "List or search notes created by the current user. "
            "Use for: 'show my notes', 'find notes about X', 'show notes from project N'. "
            "Notes are user-created text snippets. "
            "Do NOT use list_documents for notes — that is for project files/documents only."
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
        Note = _get_note_model()
        fields = _note_fields()
        payload = {}

        # title is optional — auto-generate from content if not provided
        title = args.get("title") or (args.get("content", "")[:50] + "...") if args.get("content") else "Untitled"
        if "title" in fields:
            payload["title"] = title
        elif "heading" in fields:
            payload["heading"] = title

        if "content" in fields:
            payload["content"] = args["content"]
        elif "body" in fields:
            payload["body"] = args["content"]

        if "workspace_id" in fields:
            payload["workspace_id"] = workspace_id

        # Always scope to requesting user
        if "created_by_id" in fields or "created_by" in fields:
            payload["created_by"] = user
        elif "author_id" in fields or "author" in fields:
            payload["author"] = user
        elif "user_id" in fields or "user" in fields:
            payload["user"] = user

        try:
            if "organization_id" in fields:
                payload["organization_id"] = user.organization_id
        except AttributeError:
            pass

        if args.get("project_id") and "project_id" in fields:
            payload["project_id"] = args["project_id"]

        note = Note.objects.create(**payload)
        note_title = getattr(note, "title", None) or getattr(note, "heading", "Untitled")

        return {
            "success": True,
            "note_id": note.id,
            "title":   note_title,
            "message": f"Note '{note_title}' created successfully",
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