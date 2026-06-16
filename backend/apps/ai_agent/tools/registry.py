"""
Tool Registry — single source of truth for all agent tools.
"""
from apps.ai_agent.tools.task_tools import (
    TASK_TOOL_SCHEMAS,
    get_user_projects,
    get_workspace_members,
    create_task,
    list_tasks,
    update_task,
)
from apps.ai_agent.tools.note_tools import (
    NOTE_TOOL_SCHEMAS,
    create_note,
    list_notes,
)
from apps.ai_agent.tools.project_tools import (
    PROJECT_TOOL_SCHEMAS,
    list_projects,
    get_project_summary,
)
from apps.ai_agent.tools.search_tools import (
    SEARCH_TOOL_SCHEMAS,
    search_workspace,
)

ALL_TOOL_SCHEMAS = (
    TASK_TOOL_SCHEMAS
    + NOTE_TOOL_SCHEMAS
    + PROJECT_TOOL_SCHEMAS
    + SEARCH_TOOL_SCHEMAS
)

TOOL_EXECUTORS = {
    "get_user_projects":     get_user_projects,
    "get_workspace_members": get_workspace_members,
    "create_task":           create_task,
    "list_tasks":            list_tasks,
    "update_task":           update_task,
    "create_note":           create_note,
    "list_notes":            list_notes,
    "list_projects":         list_projects,
    "get_project_summary":   get_project_summary,
    "search_workspace":      search_workspace,
}


def execute_tool(tool_name: str, tool_input: dict, user, workspace_id: str) -> dict:
    executor = TOOL_EXECUTORS.get(tool_name)
    if not executor:
        raise ValueError(f"Unknown tool: '{tool_name}'")
    return executor(tool_input, user, workspace_id)
