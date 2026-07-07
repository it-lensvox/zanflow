"""
apps/ai_agent/access/projects.py

SHARED base access query for Project — single source of truth.
Used by BOTH:
  - apps/ai_agent/tools/project_tools.py     (chat agent)
  - apps/ai_agent/search/query_builder.py    (AI Search)

Verified byte-for-byte identical in both original implementations
before this extraction: workspace_id, is_active=True, members=user.
"""


def get_user_project_queryset(user, workspace_id: str):
    """
    Returns the base Project queryset scoped to what this user is
    allowed to see: active projects in this workspace that they
    are a member of.
    """
    from apps.projects.models import Project

    return Project.objects.filter(
        workspace_id=workspace_id,
        is_active=True,
        members=user,
    ).distinct()
