"""
Tool Registry — single source of truth for all agent tools.

8 tool files · 23 tools total:
  task_tools.py         — 8 tools  (get_user_projects, get_workspace_members,
                                     create_task, list_tasks, update_task,
                                     delete_task, add_task_comment, get_task_comments)
  project_tools.py      — 2 tools  (list_projects, get_project_summary)
  note_tools.py         — 2 tools  (create_note, list_notes)
  search_tools.py       — 1 tool   (search_workspace)
  daily_update_tools.py — 4 tools  (get_daily_updates, create_daily_update,
                                     list_events, create_event)
  team_tools.py         — 2 tools  (list_team_members, get_team_summary)
  document_tools.py     — 2 tools  (list_documents, get_document_summary)
  chat_tools.py         — 1 tool   (open_chat)

Adding a new tool:
  1. Add schema to the relevant *_TOOL_SCHEMAS list
  2. Write the executor function in the relevant tool file
  3. Import both here and add to ALL_TOOL_SCHEMAS + TOOL_EXECUTORS
  That's it — the LLM auto-discovers the new tool on next request.
"""
from apps.ai_agent.tools.task_tools import (
    TASK_TOOL_SCHEMAS,
    list_workspaces,
    get_user_projects,
    get_workspace_members,
    create_task,
    list_tasks,
    update_task,
    delete_task,
    add_task_comment,
    get_task_comments,
    find_task,
)
from apps.ai_agent.tools.project_tools import (
    PROJECT_TOOL_SCHEMAS,
    create_project,
    list_projects,
    get_project_summary,
)
from apps.ai_agent.tools.note_tools import (
    NOTE_TOOL_SCHEMAS,
    create_note,
    list_notes,
)
from apps.ai_agent.tools.search_tools import (
    SEARCH_TOOL_SCHEMAS,
    search_workspace,
)
from apps.ai_agent.tools.daily_update_tools import (
    DAILY_UPDATE_TOOL_SCHEMAS,
    get_daily_updates,
    create_daily_update,
    list_events,
    create_event,
)
from apps.ai_agent.tools.team_tools import (
    TEAM_TOOL_SCHEMAS,
    list_team_members,
    get_team_summary,
)
from apps.ai_agent.tools.document_tools import (
    DOCUMENT_TOOL_SCHEMAS,
    list_documents,
    get_document_summary,
)
from apps.ai_agent.tools.chat_tools import (
    CHAT_TOOL_SCHEMAS,
    open_chat,
)

# All schemas sent to the LLM before every query
ALL_TOOL_SCHEMAS = (
    TASK_TOOL_SCHEMAS           # 8 tools
    + PROJECT_TOOL_SCHEMAS      # 2 tools
    + NOTE_TOOL_SCHEMAS         # 2 tools
    + SEARCH_TOOL_SCHEMAS       # 1 tool
    + DAILY_UPDATE_TOOL_SCHEMAS # 4 tools
    + TEAM_TOOL_SCHEMAS         # 2 tools
    + DOCUMENT_TOOL_SCHEMAS     # 2 tools
    + CHAT_TOOL_SCHEMAS         # 1 tool
)
# Total: 23 tools

# Map tool name → executor function
TOOL_EXECUTORS = {
    # Task tools
    "list_workspaces":       list_workspaces,
    "create_project":        create_project,
    "get_user_projects":     get_user_projects,
    "get_workspace_members": get_workspace_members,
    "create_task":           create_task,
    "list_tasks":            list_tasks,
    "update_task":           update_task,
    "delete_task":           delete_task,
    "add_task_comment":      add_task_comment,
    "get_task_comments":     get_task_comments,
    "find_task":             find_task,
    # Project tools
    "list_projects":         list_projects,
    "get_project_summary":   get_project_summary,
    # Note tools
    "create_note":           create_note,
    "list_notes":            list_notes,
    # Search
    "search_workspace":      search_workspace,
    # Daily update tools
    "get_daily_updates":     get_daily_updates,
    "create_daily_update":   create_daily_update,
    "list_events":           list_events,
    "create_event":          create_event,
    # Team tools
    "list_team_members":     list_team_members,
    "get_team_summary":      get_team_summary,
    # Document tools
    "list_documents":        list_documents,
    "get_document_summary":  get_document_summary,
    # Chat tools
    "open_chat":             open_chat,
}


def execute_tool(tool_name: str, tool_input: dict, user, workspace_id: str) -> dict:
    """
    Look up and call the executor for a given tool name.
    Raises ValueError if the tool is not registered.
    Every executor receives (args, user, workspace_id) and returns a dict.
    """
    executor = TOOL_EXECUTORS.get(tool_name)
    if not executor:
        raise ValueError(
            f"Unknown tool: '{tool_name}'. "
            f"Available tools: {list(TOOL_EXECUTORS.keys())}"
        )
    return executor(tool_input, user, workspace_id)