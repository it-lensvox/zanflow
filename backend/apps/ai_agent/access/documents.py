"""
apps/ai_agent/access/documents.py

SHARED base access query for Document — single source of truth.
Used by BOTH:
  - apps/ai_agent/tools/document_tools.py     (chat agent, list_documents)
  - apps/ai_agent/search/query_builder.py     (AI Search, _search_documents)

Originally only existed in document_tools.py as _user_accessible_documents().
AI Search's _search_documents() (added this session) was written to match
this exact logic. This extraction makes that explicit instead of having
two independently-written copies of the same rule.
"""


def get_user_document_queryset(user, workspace_id: str, project_id=None):
    """
    Returns the base Document queryset scoped to what this user is
    allowed to see: documents in projects they are a member of,
    OR documents explicitly shared with them via DocumentShare.
    Optional project_id narrows to a single project (used by chat's
    list_documents tool schema, which accepts project_id directly).
    """
    from django.db.models import Q
    from apps.groundtruth.models import Document

    qs = Document.objects.filter(
        workspace_id=workspace_id,
    ).filter(
        Q(project__members=user) | Q(shares__shared_with=user)
    ).distinct()

    if project_id:
        qs = qs.filter(project_id=project_id)

    return qs
