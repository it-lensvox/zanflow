"""
apps/ai_agent/access/events.py

SHARED base access query for Event — single source of truth.
Used by BOTH:
  - apps/ai_agent/tools/daily_update_tools.py  (chat agent, list_events)
  - apps/ai_agent/search/query_builder.py      (AI Search)

Verified byte-for-byte identical in both original implementations
before this extraction: Q(organizer=user) | Q(attendees=user).

NOTE: chat's list_events() additionally looks up RSVP status per event
via EventInvitation after fetching the queryset — that enrichment step
is NOT part of base access and stays in task_tools.py/daily_update_tools.py
exactly as before. This function only returns the base queryset.
"""


def get_user_event_queryset(user, workspace_id: str):
    """
    Returns the base Event queryset scoped to what this user is
    allowed to see: events they organized, or were invited to.
    """
    from django.db.models import Q
    from apps.daily_updates.models import Event

    return Event.objects.filter(
        Q(organizer=user) | Q(attendees=user)
    ).distinct()
