"""
apps/ai_agent/access/tasks.py

SHARED base access query for Task — single source of truth.
Used by BOTH:
  - apps/ai_agent/tools/task_tools.py        (chat agent)
  - apps/ai_agent/search/query_builder.py    (AI Search)

This function intentionally does ONLY the access-control scoping —
"which tasks can this user see at all" — workspace + assigned_to/assigned_by.
It deliberately does NOT apply status/priority/project filters, since
those differ between chat (defaults status to "pending") and search
(no default, filters only when explicitly requested). Each caller
applies its own filters on top of this base queryset, exactly as
each did before this extraction — only the duplicated access line
was moved here, no filtering behavior changed.
"""


def get_user_task_queryset(user, workspace_id: str):
    """
    Returns the base Task queryset scoped to what this user is
    allowed to see: tasks in this workspace that they are either
    assigned to, or that they created (assigned_by).
    Callers apply .filter(...) on top of this for status/priority/etc.
    """
    from django.db.models import Q
    from apps.tasksite.models import Task

    return Task.objects.filter(
        workspace_id=workspace_id,
    ).filter(
        Q(assigned_to=user) | Q(assigned_by=user)
    ).distinct()
