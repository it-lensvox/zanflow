"""
Project tools — user-scoped queries only.
Only returns projects the requesting user is a member of.
"""
import logging

logger = logging.getLogger(__name__)

PROJECT_TOOL_SCHEMAS = [
    {
        "name": "get_project_status",
        "description": (
            "Get the current status of a project. "
            "Use when user asks 'what is the status of ZanFlow', "
            "'is project ZanFlow active', 'what stage is ZanFlow in'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "project_name": {
                    "type": "string",
                    "description": "Name of the project to check status for",
                },
            },
            "required": ["project_name"],
        },
    },
    {
        "name": "update_project_status",
        "description": (
            "Update the status of a project. "
            "Use when user says 'archive project ZanFlow', 'mark ZanFlow as completed', "
            "'set ZanFlow to in review', 'move ZanFlow to draft'. "
            "Valid statuses: active, in_review, draft, archived, completed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "project_name": {
                    "type": "string",
                    "description": "Name of the project to update",
                },
                "status": {
                    "type": "string",
                    "enum": ["active", "in_review", "draft", "archived", "completed"],
                    "description": "New status for the project",
                },
            },
            "required": ["project_name", "status"],
        },
    },
    {
        "name": "create_project",
        "description": (
            "Create a new project in the current workspace. "
            "Use when user says 'create a project', 'new project', 'start a project called X'. "
            "The creator is automatically added as owner. "
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Project name (required)",
                },
                "description": {
                    "type": "string",
                    "description": "Optional project description",
                },
                "task_type": {
                    "type": "string",
                    "description": "Project type: client, internal, content_creation, ideas, demo (default: internal)",
                    "enum": ["client", "internal", "content_creation", "ideas", "demo"],
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "list_projects",
        "description": (
            "List projects the current user is a member of. "
            "Use when user asks 'show my projects', 'what projects do I have', etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max results (default: 10)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_project_summary",
        "description": (
            "Get a summary of a specific project the user is a member of, "
            "including task counts. Use when user asks about a specific project."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "integer",
                    "description": "The ID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
]


def create_project(args: dict, user, workspace_id: str) -> dict:
    """
    Creates a new project in the current workspace.
    Project is a TenantModel — requires organization_id and workspace_id.
    Creator is automatically added as OWNER via ProjectMembership.
    """
    try:
        from apps.projects.models import Project, ProjectMembership
        from apps.organizations.models import Workspace

        name = args.get("name", "").strip()
        if not name:
            return {"success": False, "error": "Project name is required."}

        # Project is TenantModel — need organization_id from workspace
        workspace = Workspace.objects.filter(id=workspace_id).select_related("organization").first()
        if not workspace:
            return {"success": False, "error": f"Workspace {workspace_id} not found."}

        # Check for duplicate name in this workspace
        if Project.objects.filter(workspace_id=workspace_id, name__iexact=name, status="active").exists():
            return {
                "success": False,
                "error":   f"A project named '{name}' already exists in this workspace.",
            }

        project = Project(
            name=name,
            description=args.get("description", ""),
            task_type=args.get("task_type", "internal"),
            workspace_id=workspace_id,
            organization_id=workspace.organization_id,
            created_by=user,
            updated_by=user,
        )
        project.save()

        # Add creator as OWNER
        ProjectMembership.objects.create(
            project=project,
            user=user,
            role=ProjectMembership.Role.OWNER,
        )

        return {
            "success":     True,
            "project_id":  project.id,
            "name":        project.name,
            "task_type":   project.task_type,
            "workspace_id": workspace_id,
        }

    except Exception as exc:
        logger.exception("create_project failed: %s", exc)
        return {"success": False, "error": str(exc)}


def list_projects(args: dict, user, workspace_id: str) -> dict:
    try:
        from apps.ai_agent.access.projects import get_user_project_queryset

        # User-scoped — only projects user is a member of
        qs = get_user_project_queryset(user, workspace_id)

        limit = min(args.get("limit", 10), 50)
        projects = qs.order_by("name")[:limit]

        total_count = qs.count()
        projects_list = [{"id": p.id, "name": p.name} for p in projects]

        return {
            "success":  True,
            "total":    total_count,
            "returned": len(projects_list),
            "has_more": total_count > limit,
            "projects": projects_list,
        }

    except Exception as exc:
        logger.exception("list_projects failed: %s", exc)
        return {"success": False, "error": str(exc)}


def get_project_status(args: dict, user, workspace_id: str) -> dict:
    """
    Returns the current status of a project.
    """
    try:
        from apps.projects.models import Project

        project_name = args.get("project_name", "").strip()
        if not project_name:
            return {"success": False, "error": "project_name is required."}

        project = Project.objects.filter(
            workspace_id=workspace_id,
            members=user,
            name__icontains=project_name,
        ).first()

        if not project:
            return {"success": False, "error": f"Project '{project_name}' not found or you are not a member."}

        return {
            "success":      True,
            "project_id":   project.id,
            "project_name": project.name,
            "status":       project.status,
            "status_display": project.get_status_display(),
            "task_type":    project.task_type,
        }

    except Exception as exc:
        logger.exception("get_project_status failed: %s", exc)
        return {"success": False, "error": str(exc)}


def update_project_status(args: dict, user, workspace_id: str) -> dict:
    """
    Updates the status of a project.
    Only the project owner or admin can change status.
    Valid statuses: active, in_review, draft, archived, completed.
    """
    try:
        from apps.projects.models import Project, ProjectMembership

        project_name = args.get("project_name", "").strip()
        new_status   = args.get("status", "").strip()

        if not project_name:
            return {"success": False, "error": "project_name is required."}
        if not new_status:
            return {"success": False, "error": "status is required."}

        valid_statuses = ["active", "in_review", "draft", "archived", "completed"]
        if new_status not in valid_statuses:
            return {
                "success": False,
                "error":   f"Invalid status '{new_status}'. Valid values: {', '.join(valid_statuses)}",
            }

        # Find the project
        project = Project.objects.filter(
            workspace_id=workspace_id,
            members=user,
            name__icontains=project_name,
        ).first()

        if not project:
            return {"success": False, "error": f"Project '{project_name}' not found or you are not a member."}

        # Check user has permission — must be owner or admin
        membership = ProjectMembership.objects.filter(
            project=project,
            user=user,
            role__in=["owner", "admin", "manager"],
        ).first()

        if not membership:
            return {
                "success": False,
                "error":   f"You don't have permission to change the status of '{project.name}'. Only owners, admins, and managers can do this.",
            }

        old_status = project.status
        project.status     = new_status
        project.updated_by = user
        project.save(update_fields=["status", "updated_by", "updated_at"])

        return {
            "success":          True,
            "project_id":       project.id,
            "project_name":     project.name,
            "old_status":       old_status,
            "new_status":       new_status,
            "status_display":   project.get_status_display(),
        }

    except Exception as exc:
        logger.exception("update_project_status failed: %s", exc)
        return {"success": False, "error": str(exc)}


def get_project_summary(args: dict, user, workspace_id: str) -> dict:
    try:
        from apps.ai_agent.access.projects import get_user_project_queryset

        # User-scoped — can only view projects they are a member of
        project = get_user_project_queryset(user, workspace_id).filter(
            id=args["project_id"],
        ).first()

        if not project:
            return {
                "success": False,
                "error": "Project not found or you are not a member of it.",
            }

        task_counts = {}
        try:
            from apps.tasksite.models import Task
            from django.db.models import Q
            tasks = Task.objects.filter(
                project=project,
                workspace_id=workspace_id,
            ).filter(
                Q(assigned_to=user) | Q(assigned_by=user)
            ).distinct()
            task_counts = {
                "total":       tasks.count(),
                "open":        tasks.filter(status="open").count(),
                "in_progress": tasks.filter(status="in_progress").count(),
                "done":        tasks.filter(status="done").count(),
            }
        except Exception:
            pass

        return {
            "success": True,
            "project": {
                "id":          project.id,
                "name":        project.name,
                "description": project.description or "",
                "task_counts": task_counts,
            },
        }

    except Exception as exc:
        logger.exception("get_project_summary failed: %s", exc)
        return {"success": False, "error": str(exc)}