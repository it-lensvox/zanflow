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


def apply_task_filters(qs, user=None,
                       status=None, priority=None,
                       project_id=None, project_name=None,
                       search_text=None, overdue=None,
                       assigned_to_me=None, assignee_name=None,
                       updated_today=None, label_name=None):
    """
    Applies optional filter conditions to a Task queryset.
    Single source of truth for ALL task filtering logic.
    Used by BOTH:
      - apps/ai_agent/tools/task_tools.py   (chat agent, list_tasks)
      - apps/ai_agent/search/query_builder.py (_search_tasks)

    All parameters optional — only filters that are explicitly passed
    (not None) are applied. Callers keep full control of:
      - Default values (chat defaults status to "pending", search has no default)
      - Ordering (-created_at vs -updated_at)
      - Response formatting (emails vs full names in assigned_to)

    Adding a new filter here automatically makes it available in
    both chat and search — no duplication needed.
    """
    from django.db.models import Q
    from datetime import date

    if status and status != "all":
        qs = qs.filter(status=status)

    if priority:
        qs = qs.filter(priority=priority)

    if project_id:
        qs = qs.filter(project_id=project_id)

    if project_name:
        qs = qs.filter(project__name__icontains=project_name)

    if search_text:
        qs = qs.filter(
            Q(heading__icontains=search_text) |
            Q(description__icontains=search_text)
        )

    if overdue is True:
        qs = qs.filter(
            end_date__lt=date.today(),
            status__in=["pending", "in_progress", "review", "backlog"],
        )

    if assigned_to_me is True and user:
        qs = qs.filter(assigned_to=user)

    if assignee_name:
        qs = qs.filter(
            Q(assigned_to__first_name__icontains=assignee_name) |
            Q(assigned_to__last_name__icontains=assignee_name)
        ).distinct()

    if updated_today is True and user:
        qs = qs.filter(
            updated_at__date=date.today(),
            status_updated_by=user,
            status__in=["in_progress", "completed", "review", "deployed"],
        )

    if label_name:
        qs = qs.filter(
            labels__name__icontains=label_name
        ).distinct()

    return qs