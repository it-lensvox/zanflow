"""
apps/ai_agent/access/members.py

SHARED base access query for workspace Members — single source of truth.
Used by BOTH:
  - apps/ai_agent/search/query_builder.py    (AI Search)
  - Future: any other consumer needing member lookup

Returns users who are members of the given workspace,
excluding the requesting user themselves.
"""


def get_workspace_member_queryset(user, workspace_id: str):
    """
    Returns the base User queryset scoped to members of this workspace,
    excluding the current user themselves.
    Callers apply .filter(...) on top for name/email search.
    """
    from apps.users.models import User
    from apps.organizations.models import WorkspaceMembership

    member_ids = WorkspaceMembership.objects.filter(
        workspace_id=workspace_id,
    ).values_list("user_id", flat=True)

    return User.objects.filter(
        id__in=member_ids,
    ).exclude(id=user.id)
