"""
Document tools — wraps apps.groundtruth models.

Models:
  - Document (TenantModel — id UUID, project FK, status, file_type,
               preview_status, current_gt_version FK)
  - GTVersion (document FK, version_number, gt_data JSON, is_approved)
  - DocumentShare (document FK, shared_with user FK, shared_project FK)
"""
import logging

logger = logging.getLogger(__name__)

DOCUMENT_TOOL_SCHEMAS = [
    {
        "name": "list_documents",
        "description": (
            "List documents in a project that the current user has access to. "
            "Includes documents shared with the user via DocumentShare. "
            "Use when user asks 'show documents', 'list files in project X', "
            "'what documents are in review'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "integer",
                    "description": "Filter by project ID (optional — shows all accessible if omitted)",
                },
                "status": {
                    "type": "string",
                    "enum": ["draft", "in_review", "approved", "archived"],
                    "description": "Filter by document status (optional)",
                },
                "file_type": {
                    "type": "string",
                    "enum": ["pdf", "image", "json", "text", "video", "mp4", "other"],
                    "description": "Filter by file type (optional)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max documents to return (default: 10)",
                },
                "offset": {
                    "type": "integer",
                    "description": "Pagination offset (default: 0)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_document_summary",
        "description": (
            "Get details of a specific document including its status, "
            "ground truth version info, and preview availability. "
            "Use when user asks 'what is the status of document X', "
            "'show document details', 'is this document approved'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": "The UUID of the document",
                },
            },
            "required": ["document_id"],
        },
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_accessible_documents(user, workspace_id, project_id=None):
    """
    Returns a queryset of documents accessible to the user:
      - Documents in projects they are a member of
      - Documents explicitly shared with them via DocumentShare

    Thin wrapper kept here for backward compatibility — actual logic
    now lives in apps.ai_agent.access.documents, shared with AI Search.
    """
    from apps.ai_agent.access.documents import get_user_document_queryset

    return get_user_document_queryset(user, workspace_id, project_id)


# ── Executors ─────────────────────────────────────────────────────────────────

def list_documents(args: dict, user, workspace_id: str) -> dict:
    """
    Lists documents accessible to the user with optional filters.
    """
    try:
        project_id = args.get("project_id")
        limit  = min(args.get("limit", 10), 50)
        offset = args.get("offset", 0)

        qs = _user_accessible_documents(user, workspace_id, project_id)

        if args.get("status"):
            qs = qs.filter(status=args["status"])

        if args.get("file_type"):
            qs = qs.filter(file_type=args["file_type"])

        total_count = qs.count()
        docs = qs.select_related("project", "current_gt_version").order_by("-created_at")[offset: offset + limit]

        return {
            "success":   True,
            "total":     total_count,
            "returned":  len(docs),
            "offset":    offset,
            "has_more":  (offset + limit) < total_count,
            "documents": [
                {
                    "id":             str(d.id),
                    "name":           d.name,
                    "project":        d.project.name if d.project else "",
                    "status":         d.status,
                    "file_type":      d.file_type,
                    "preview_status": d.preview_status,
                    "has_gt_version": d.current_gt_version_id is not None,
                }
                for d in docs
            ],
        }

    except Exception as exc:
        logger.exception("list_documents failed: %s", exc)
        return {"success": False, "error": str(exc)}


def get_document_summary(args: dict, user, workspace_id: str) -> dict:
    """
    Returns detailed summary of a single document.
    Checks user has access via project membership or DocumentShare.
    """
    try:
        from apps.groundtruth.models import Document, GTVersion

        doc_id = args.get("document_id", "").strip()
        if not doc_id:
            return {"success": False, "error": "document_id is required."}

        qs = _user_accessible_documents(user, workspace_id)
        doc = qs.filter(id=doc_id).select_related(
            "project", "current_gt_version"
        ).first()

        if not doc:
            return {
                "success": False,
                "error": "Document not found or you do not have access to it.",
            }

        # Count all GT versions for this document
        version_count = GTVersion.objects.filter(document=doc).count()

        # Build GT version info
        gt_info = None
        if doc.current_gt_version:
            v = doc.current_gt_version
            gt_info = {
                "version_number": v.version_number,
                "is_approved":    v.is_approved,
                "approved_by":    v.approved_by.get_full_name() if v.approved_by else None,
                "source_type":    v.source_type,
            }

        # Preview URL — only available when ready
        preview_url = None
        if doc.preview_status == "ready" and doc.preview_pdf:
            try:
                preview_url = doc.preview_pdf.url
            except Exception:
                pass

        return {
            "success": True,
            "document": {
                "id":              str(doc.id),
                "name":            doc.name,
                "project":         doc.project.name if doc.project else "",
                "status":          doc.status,
                "file_type":       doc.file_type,
                "preview_status":  doc.preview_status,
                "preview_pdf_url": preview_url,
                "version_count":   version_count,
                "current_gt_version": gt_info,
            },
        }

    except Exception as exc:
        logger.exception("get_document_summary failed: %s", exc)
        return {"success": False, "error": str(exc)}