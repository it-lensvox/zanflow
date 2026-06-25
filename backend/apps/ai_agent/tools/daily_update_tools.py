"""
Daily Update tools — standups and calendar events.

Wraps apps.daily_updates models:
  - DailyUpdate (user FK, date, content — unique_together user+date)
  - Event (organizer FK, title, start_time, end_time, attendees M2M)
  - EventInvitation (event FK, user FK, status PENDING/ACCEPTED/DECLINED/RESCHEDULE_REQUESTED)
"""
import logging

logger = logging.getLogger(__name__)

DAILY_UPDATE_TOOL_SCHEMAS = [
    {
        "name": "get_daily_updates",
        "description": (
            "Get daily standup updates. "
            "Admins and managers see all team updates for the date. "
            "Regular users see only their own update. "
            "Use when user asks 'what did the team do today', 'show standup', "
            "'what is my update for today'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date in YYYY-MM-DD format (default: today)",
                },
                "user_id": {
                    "type": "integer",
                    "description": "Filter by a specific user's update (optional, managers only)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "create_daily_update",
        "description": (
            "Create or update today's standup entry for the current user. "
            "If an update already exists for today it will be updated (upsert). "
            "Use when user says 'post my standup', 'add my daily update', 'log my update'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "The standup content — what the user did / plans to do",
                },
                "date": {
                    "type": "string",
                    "description": "Date in YYYY-MM-DD format (default: today)",
                },
            },
            "required": ["content"],
        },
    },
    {
        "name": "list_events",
        "description": (
            "List upcoming calendar events for the current user — "
            "both events they organised and events they were invited to. "
            "Use when user asks 'show my events', 'what meetings do I have', "
            "'show my calendar', 'upcoming events'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Filter from this date YYYY-MM-DD (default: today)",
                },
                "end_date": {
                    "type": "string",
                    "description": "Filter until this date YYYY-MM-DD (optional)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max events to return (default: 10)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "create_event",
        "description": (
            "Create a calendar event and optionally invite attendees. "
            "Use when user says 'schedule a meeting', 'create an event', 'set up a call'. "
            "If attendees are mentioned by name, call get_workspace_members first to resolve emails."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Event title",
                },
                "start_time": {
                    "type": "string",
                    "description": "Start datetime in ISO format: YYYY-MM-DDTHH:MM:SS",
                },
                "end_time": {
                    "type": "string",
                    "description": "End datetime in ISO format: YYYY-MM-DDTHH:MM:SS",
                },
                "attendee_emails": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of attendee email addresses (optional)",
                },
                "is_online_meeting": {
                    "type": "boolean",
                    "description": "True if it is an online meeting (default: false)",
                },
                "location": {
                    "type": "string",
                    "description": "Physical location (optional)",
                },
                "description": {
                    "type": "string",
                    "description": "Event description (optional)",
                },
                "event_type": {
                    "type": "string",
                    "description": "Type of event e.g. Meeting, Review, Workshop (default: Meeting)",
                },
            },
            "required": ["title", "start_time", "end_time"],
        },
    },
]


# ── Executors ─────────────────────────────────────────────────────────────────

def get_daily_updates(args: dict, user, workspace_id: str) -> dict:
    """
    Returns daily standup updates.
    Managers/admins see all users; regular users see only their own.
    """
    try:
        from datetime import date as date_cls
        from apps.daily_updates.models import DailyUpdate

        target_date = args.get("date") or str(date_cls.today())

        # Check if user is admin or manager — they see all updates
        is_manager = getattr(user, "role", "") in ("admin", "manager")

        if is_manager:
            qs = DailyUpdate.objects.filter(date=target_date).select_related("user")
        else:
            qs = DailyUpdate.objects.filter(date=target_date, user=user).select_related("user")

        # Optional single-user filter (managers only)
        if args.get("user_id") and is_manager:
            qs = qs.filter(user_id=args["user_id"])

        updates = list(qs.order_by("user__first_name"))

        return {
            "success": True,
            "date":    target_date,
            "total":   len(updates),
            "updates": [
                {
                    "user":       u.user.get_full_name() or u.user.email,
                    "content":    u.content,
                    "created_at": str(u.created_at),
                    "updated_at": str(u.updated_at),
                }
                for u in updates
            ],
        }

    except Exception as exc:
        logger.exception("get_daily_updates failed: %s", exc)
        return {"success": False, "error": str(exc)}


def create_daily_update(args: dict, user, workspace_id: str) -> dict:
    """
    Creates or updates the user's standup for a given date.
    unique_together (user, date) — if an entry exists it is updated (upsert).
    """
    try:
        from datetime import date as date_cls
        from apps.daily_updates.models import DailyUpdate

        content = args.get("content", "").strip()
        if not content:
            return {"success": False, "error": "Content cannot be empty."}

        target_date = args.get("date") or str(date_cls.today())

        update, created = DailyUpdate.objects.update_or_create(
            user=user,
            date=target_date,
            defaults={"content": content},
        )

        action = "created" if created else "updated"
        return {
            "success":    True,
            "update_id":  update.id,
            "date":       str(update.date),
            "content":    update.content,
            "action":     action,
            "message":    f"Daily update {action} for {target_date}.",
        }

    except Exception as exc:
        logger.exception("create_daily_update failed: %s", exc)
        return {"success": False, "error": str(exc)}


def list_events(args: dict, user, workspace_id: str) -> dict:
    """
    Returns events the user organised or was invited to.
    Optionally filtered by date range.
    """
    try:
        from datetime import date as date_cls
        from django.db.models import Q
        from apps.daily_updates.models import Event, EventInvitation

        start = args.get("start_date") or str(date_cls.today())
        limit = min(args.get("limit", 10), 50)

        # Events user organised OR was invited to
        qs = Event.objects.filter(
            Q(organizer=user) | Q(attendees=user)
        ).filter(
            start_time__date__gte=start
        ).distinct()

        if args.get("end_date"):
            qs = qs.filter(start_time__date__lte=args["end_date"])

        qs = qs.select_related("organizer").order_by("start_time")[:limit]

        events = []
        for e in qs:
            # Get current user's RSVP status for this event
            rsvp = "N/A"
            if e.organizer_id == user.id:
                rsvp = "organizer"
            else:
                inv = EventInvitation.objects.filter(event=e, user=user).first()
                rsvp = inv.status if inv else "PENDING"

            events.append({
                "id":              e.id,
                "title":           e.title,
                "event_type":      e.event_type,
                "start_time":      str(e.start_time),
                "end_time":        str(e.end_time),
                "location":        e.location or "",
                "is_online":       e.is_online_meeting,
                "organizer":       e.organizer.get_full_name() or e.organizer.email,
                "rsvp_status":     rsvp,
            })

        return {
            "success": True,
            "total":   len(events),
            "events":  events,
        }

    except Exception as exc:
        logger.exception("list_events failed: %s", exc)
        return {"success": False, "error": str(exc)}


def create_event(args: dict, user, workspace_id: str) -> dict:
    """
    Creates a calendar event and sends invitations to attendees.
    Creates EventInvitation rows for each attendee with status=PENDING.
    """
    try:
        from apps.daily_updates.models import Event, EventInvitation
        from apps.users.models import User

        title = args.get("title", "").strip()
        if not title:
            return {"success": False, "error": "Event title is required."}

        start_time = args.get("start_time")
        end_time   = args.get("end_time")
        if not start_time or not end_time:
            return {"success": False, "error": "start_time and end_time are required."}

        event = Event.objects.create(
            organizer=user,
            title=title,
            event_type=args.get("event_type", "Meeting"),
            start_time=start_time,
            end_time=end_time,
            location=args.get("location", "") or "",
            is_online_meeting=args.get("is_online_meeting", False),
            description=args.get("description", "") or "",
        )

        # Create invitations for each attendee email
        attendee_emails = args.get("attendee_emails", [])
        invited_count = 0
        not_found = []

        for email in attendee_emails:
            if email.lower() == user.email.lower():
                continue  # skip organiser
            attendee = User.objects.filter(email=email, is_active=True).first()
            if attendee:
                EventInvitation.objects.get_or_create(
                    event=event,
                    user=attendee,
                    defaults={"status": "PENDING"},
                )
                invited_count += 1
            else:
                not_found.append(email)

        result = {
            "success":        True,
            "event_id":       event.id,
            "title":          event.title,
            "start_time":     str(event.start_time),
            "end_time":       str(event.end_time),
            "is_online":      event.is_online_meeting,
            "attendee_count": invited_count,
            "message":        f"Event '{title}' created with {invited_count} invitation(s) sent.",
        }

        if not_found:
            result["warning"] = f"These emails were not found in Dyuksa: {', '.join(not_found)}"

        return result

    except Exception as exc:
        logger.exception("create_event failed: %s", exc)
        return {"success": False, "error": str(exc)}