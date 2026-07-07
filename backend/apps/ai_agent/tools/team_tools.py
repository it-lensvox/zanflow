"""
Team tools — wraps apps.teams models.

Team and TeamMember both use TenantSoftDeleteManager so deleted_at IS NULL
filtering is handled automatically by the default manager.

Models:
  - Team (name, team_type, color, description, leader FK, deleted_at)
  - TeamMember (team FK, user FK, role, added_by FK, deleted_at)
"""
import logging

logger = logging.getLogger(__name__)

TEAM_TOOL_SCHEMAS = [
    {
        "name": "list_team_members",
        "description": (
            "List all active members of a specific team. "
            "The current user must be a member of that team. "
            "Use when user asks 'who is in team X', 'show team members', "
            "'list members of the design team'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "team_id": {
                    "type": "integer",
                    "description": "The ID of the team",
                },
                "team_name": {
                    "type": "string",
                    "description": "Search team by name instead of ID (optional)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_team_summary",
        "description": (
            "Get a summary of a team including its type, color, leader, "
            "and total member count. "
            "Use when user asks 'tell me about team X', 'show team info', "
            "'what is the development team'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "team_id": {
                    "type": "integer",
                    "description": "The ID of the team",
                },
                "team_name": {
                    "type": "string",
                    "description": "Search team by name instead of ID (optional)",
                },
            },
            "required": [],
        },
    },
]


# ── Executors ─────────────────────────────────────────────────────────────────

def _resolve_team(team_id, team_name, user):
    """
    Resolve team by ID or name. Returns the Team object or None.
    The user must be an active member of the team.
    """
    from apps.teams.models import Team, TeamMember

    # Get IDs of teams this user is an active member of
    user_team_ids = TeamMember.objects.filter(user=user).values_list("team_id", flat=True)

    qs = Team.objects.filter(id__in=user_team_ids)

    if team_id:
        return qs.filter(id=team_id).first()
    if team_name:
        return qs.filter(name__icontains=team_name).first()
    return None


def list_team_members(args: dict, user, workspace_id: str) -> dict:
    """
    Returns active members of a team.
    User must be a member of the team.
    TenantSoftDeleteManager handles deleted_at IS NULL automatically.
    """
    try:
        from apps.teams.models import Team, TeamMember

        team_id   = args.get("team_id")
        team_name = args.get("team_name", "").strip()

        if not team_id and not team_name:
            return {"success": False, "error": "Provide team_id or team_name."}

        team = _resolve_team(team_id, team_name, user)
        if not team:
            return {
                "success": False,
                "error": "Team not found or you are not a member of it.",
            }

        # TenantSoftDeleteManager auto-excludes deleted members
        members = TeamMember.objects.filter(team=team).select_related("user").order_by("user__first_name")

        return {
            "success":     True,
            "team_id":     team.id,
            "team_name":   team.name,
            "total":       members.count(),
            "members": [
                {
                    "user_id": m.user_id,
                    "name":    m.user.get_full_name() or m.user.email,
                    "email":   m.user.email,
                    "role":    m.role,
                }
                for m in members
            ],
        }

    except Exception as exc:
        logger.exception("list_team_members failed: %s", exc)
        return {"success": False, "error": str(exc)}


def get_team_summary(args: dict, user, workspace_id: str) -> dict:
    """
    Returns team metadata including type, color, leader, and member count.
    """
    try:
        from apps.teams.models import Team, TeamMember

        team_id   = args.get("team_id")
        team_name = args.get("team_name", "").strip()

        if not team_id and not team_name:
            return {"success": False, "error": "Provide team_id or team_name."}

        team = _resolve_team(team_id, team_name, user)
        if not team:
            return {
                "success": False,
                "error": "Team not found or you are not a member of it.",
            }

        member_count = TeamMember.objects.filter(team=team).count()

        leader_name = ""
        if team.leader_id:
            try:
                leader_name = team.leader.get_full_name() or team.leader.email
            except Exception:
                pass

        return {
            "success": True,
            "team": {
                "id":           team.id,
                "name":         team.name,
                "team_type":    team.team_type,
                "color":        team.color,
                "description":  team.description or "",
                "leader":       leader_name,
                "member_count": member_count,
            },
        }

    except Exception as exc:
        logger.exception("get_team_summary failed: %s", exc)
        return {"success": False, "error": str(exc)}