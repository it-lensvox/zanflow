"""
apps/ai_agent/tools/chat_tools.py

Chat navigation tool — lets the agent open or reference
a private chat room with any workspace member.

Uses the existing POST /api/v1/chat/rooms/private/ endpoint
which already handles get-or-create correctly.
Only one tool: open_chat
"""
import logging

logger = logging.getLogger(__name__)

CHAT_TOOL_SCHEMAS = [
    {
        "name": "open_chat",
        "description": (
            "Find or create a chat room — either a private chat with a workspace member, "
            "or a project chat room. "
            "Use when user says 'I want to chat with X', 'open chat with X', "
            "'message X', 'talk to X', 'open ZanFlow chat', 'open project chat for X'. "
            "Pass member_name for person chats, project_name for project chats. "
            "Returns the chat room ID for the frontend to navigate directly."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "member_name": {
                    "type": "string",
                    "description": "First name, last name, or full name of the PERSON to chat with. Use for private chats only.",
                },
                "project_name": {
                    "type": "string",
                    "description": "Name of the PROJECT whose chat room to open. Use when user mentions a project name.",
                },
            },
            "required": [],
        },
    },
]


def open_chat(args: dict, user, workspace_id: str) -> dict:
    """
    Finds or creates a chat room — either:
      A) Private chat with a workspace member (member_name provided)
      B) Project chat room (project_name provided)

    When a project is created, a chat room is auto-created for it.
    This tool finds that existing room rather than creating a new one.
    """
    try:
        from django.db.models import Q
        from apps.chat.services import ChatRoomService

        member_name  = (args.get("member_name") or "").strip()
        project_name = (args.get("project_name") or "").strip()

        # ── Validate: at least one of member_name or project_name must be given
        if not member_name and not project_name:
            return {"success": False, "error": "Provide either member_name or project_name."}

        # ── CASE B: Project chat room ─────────────────────────────────────────
        if project_name:
            from apps.projects.models import Project

            project = Project.objects.filter(
                workspace_id=workspace_id,
                members=user,
                name__icontains=project_name,
                status="active",
            ).first()

            if not project:
                return {
                    "success": False,
                    "error":   f"Project '{project_name}' not found or you are not a member.",
                }

            # get_or_create the project chat room
            room = ChatRoomService.create_project_room(project, user)

            return {
                "success":      True,
                "room_id":      str(room.id),
                "room_type":    "project",
                "project_name": project.name,
                "project_id":   project.id,
            }

        # ── CASE A: Private chat with a workspace member ──────────────────────
        from apps.users.models import User
        from apps.organizations.models import WorkspaceMembership

        workspace_member_ids = WorkspaceMembership.objects.filter(
            workspace_id=workspace_id
        ).values_list("user_id", flat=True)

        parts      = member_name.split()
        candidates = User.objects.filter(id__in=workspace_member_ids).filter(
            Q(first_name__icontains=parts[0]) |
            Q(last_name__icontains=parts[-1]) |
            Q(email__icontains=member_name)
        ).exclude(id=user.id).distinct()

        if not candidates.exists():
            return {
                "success": False,
                "error":   f"'{member_name}' not found in your workspace.",
            }

        # Prefer exact first name match when multiple candidates
        exact      = candidates.filter(first_name__iexact=parts[0])
        other_user = exact.first() if exact.exists() else candidates.first()

        room, created = ChatRoomService.get_or_create_private_room(user, other_user)

        return {
            "success":     True,
            "room_id":     str(room.id),
            "room_type":   "private",
            "member_name": other_user.get_full_name() or other_user.email,
            "member_id":   other_user.id,
            "created":     created,
        }

    except Exception as exc:
        logger.exception("open_chat failed: %s", exc)
        return {"success": False, "error": str(exc)}