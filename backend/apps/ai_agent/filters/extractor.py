"""
apps/ai_agent/filters/extractor.py

SHARED filter extraction module — single source of truth.
Used by BOTH:
  - apps/ai_agent/search/intent.py        (AI Search endpoint)
  - apps/ai_agent/orchestrator.py         (Chat agent, via list_tasks)

This is the EXACT, UNMODIFIED logic that was previously only in
search/intent.py. Moved here so both systems share one implementation
instead of duplicating filter logic in two places.

Responsible for two things only:
  1. classify_intent(query) → "search" | "action"
  2. extract_filters(query) → structured dict for query_builder

Uses GPT-4o-mini with temperature=0 for deterministic output.
Both functions fail safe — on any LLM error they return a safe default.
"""
import json
import logging

logger = logging.getLogger(__name__)

# ── Prompts ────────────────────────────────────────────────────────────────────

_INTENT_SYSTEM_PROMPT = """You are an intent classifier for Dyuksa, a project management app.

Classify the user query as exactly one of:
  "search" → user wants to FIND or VIEW data that exists in the system
             Triggers: show, list, find, search, who, what, display, get, how many
             Valid search targets: tasks, notes, projects, events, documents, members
             "how many X" about tasks/notes/projects/events/documents → ALWAYS search
  "action" → user wants to DO something
             Triggers: create, update, delete, assign, mark, move, add, change, remove, defer
             ONLY classify as "action" for workspace/account questions (not searchable):
             "how many workspaces do I have", "which workspace am I in"

CRITICAL RULE: "how many tasks/notes/projects/events" → ALWAYS "search", never "action"

Examples:s
  "find Ravi in workspace"              → search
  "show my tasks"                       → search
  "how many pending tasks in ZanFlow"   → search  ← tasks are searchable
  "how many tasks do I have"            → search  ← tasks are searchable
  "who is in my workspace"              → search
  "how many workspace I have"           → action  ← workspaces are NOT searchable
  "create a task"                       → action
  "mark task 119 as done"               → action

Return ONLY valid JSON with a single key. No explanation. No markdown.
{"intent": "search"}  OR  {"intent": "action"}"""

_FILTER_SYSTEM_PROMPT = """You are a search filter extractor for Dyuksa, a project management app.

Extract structured filters from the user query and return ONLY valid JSON.
No explanation. No markdown. No extra keys.

Valid status values  : pending, in_progress, completed, review, deployed, deferred, backlog
Valid priority values: low, medium, high, critical

Status aliases (always map to DB value):
  remaining/open/not started/todo              → pending
  in progress/wip/ongoing/active/working on    → in_progress
  review/needs review/ready for review/pr      → review
  done/complete/finished/closed/resolved       → completed
  production/in production/live/shipped/launched/released → deployed
  hold/on hold/cancelled/paused/blocked        → deferred
  backlog/parked/future                        → backlog

Priority aliases (always map to DB value):
  urgent/blocker/asap/emergency/top priority   → critical
  important/high priority                      → high
  normal/moderate/standard                     → medium
  minor/lowest/nice to have/not urgent         → low
Valid models         : task, note, project, event, document, member
Document aliases     : document, documents, file, files → models includes "document"
Member aliases       : member, members, teammate, teammates, people, workspace members, who → models includes "member"
Favourite aliases    : favourite, favorite, starred, bookmarked, saved → set is_favourite=true

JSON schema (use null for any field not mentioned in the query):
{
  "models":         ["task"|"note"|"project"|"event"|"document"|"member"],  // which models to search
  "search_text":    "string | null",            // keyword in heading/title/description
  "label_name":     "string | null",            // label/tag name to filter tasks by (e.g. "deployment", "bug")
  "doc_status":     "string | null",            // document status: draft, in_review, approved, archived
  "file_type":      "string | null",            // document file type: pdf, image, json, text, video, mp4, other
  "status":         "string | null",            // task status
  "priority":       "string | null",            // task priority
  "assignee_name":  "string | null",            // person first or full name
  "project_name":   "string | null",            // project name
  "overdue":        true | false | null,        // true = end_date is in the past
  "assigned_to_me": true | false | null,        // true = assigned to current user
  "today":          true | false | null,        // true = events scheduled today
  "date":           "YYYY-MM-DD | null",        // specific date for events
  "is_favourite":   true | false | null         // true = user's favourite/starred projects
}

Examples for favourites:
  "find my favourite projects"   → models=["project"], is_favourite=true
  "show my starred projects"     → models=["project"], is_favourite=true
  "find all favourites project"  → models=["project"], is_favourite=true

Examples:
  "find my events today"              → models=["event"], today=true
  "show events scheduled today"       → models=["event"], today=true
  "find meeting about API"            → models=["event"], search_text="API"
  "show critical tasks"               → models=["task"], priority="critical"
  "find notes about budget"           → models=["note"], search_text="budget"
  "find all documents under ZanFlow project" → models=["document"], project_name="ZanFlow"
  "find tasks with label deployment"          → models=["task"], label_name="deployment"
  "show tasks tagged as frontend"             → models=["task"], label_name="frontend"
  "find bug label tasks in ZanFlow"           → models=["task"], label_name="bug", project_name="ZanFlow"
  "find approved documents in ZanFlow"        → models=["document"], doc_status="approved", project_name="ZanFlow"
  "show PDF documents"                        → models=["document"], file_type="pdf"
  "find draft documents"                      → models=["document"], doc_status="draft"
  "show files in Mockflow"            → models=["document"], project_name="Mockflow"
  "who is in my workspace"            → models=["member"]
  "find Ravi in my workspace"         → models=["member"], search_text="Ravi"
  "list all teammates"                → models=["member"]
  "show everything about ZanFlow"     → models=["task","note","project","event","document","member"], project_name="ZanFlow"
  "find my favourite projects"        → models=["project"], is_favourite=true
  "show my starred projects"          → models=["project"], is_favourite=true
  "show my bookmarked projects"       → models=["project"], is_favourite=true
"""


# ── LLM helper ────────────────────────────────────────────────────────────────

def _call_gpt(system_prompt: str, user_query: str) -> dict:
    """
    Single GPT-4o-mini call. Returns parsed JSON dict.
    Raises on failure — callers handle the fallback.
    """
    from apps.ai_agent.llm_client import get_llm_client
    import openai

    llm    = get_llm_client()
    client = openai.OpenAI(api_key=llm.api_key)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_query},
        ],
        max_tokens=200,
        temperature=0,
    )
    raw = response.choices[0].message.content.strip()
    return json.loads(raw)


# ── Public API ─────────────────────────────────────────────────────────────────

def classify_intent(query: str) -> str:
    """
    Returns "search" or "action".
    Defaults to "search" on any failure so the user always gets results.
    """
    try:
        result = _call_gpt(_INTENT_SYSTEM_PROMPT, query)
        intent = result.get("intent", "search")
        return intent if intent in ("search", "action") else "search"
    except Exception as exc:
        logger.warning("classify_intent failed, defaulting to search: %s", exc)
        return "search"


def extract_filters(query: str) -> dict:
    """
    Returns structured filter dict from natural language query.
    Defaults to full-text search across all models on any failure.
    """
    try:
        result = _call_gpt(_FILTER_SYSTEM_PROMPT, query)
        return {
            "models":         result.get("models", ["task", "note", "project", "event", "document"]),
            "search_text":    result.get("search_text"),
            "label_name":     result.get("label_name"),
            "doc_status":     result.get("doc_status"),
            "file_type":      result.get("file_type"),
            "status":         result.get("status"),
            "priority":       result.get("priority"),
            "assignee_name":  result.get("assignee_name"),
            "project_name":   result.get("project_name"),
            "overdue":        result.get("overdue"),
            "assigned_to_me": result.get("assigned_to_me"),
            "today":          result.get("today"),
            "date":           result.get("date"),
            "is_favourite":   result.get("is_favourite"),
            "is_favourite":   result.get("is_favourite"),
        }
    except Exception as exc:
        logger.warning("extract_filters failed, using keyword fallback: %s", exc)
        return {
            "models":         ["task", "note", "project", "event", "document"],
            "search_text":    query,
            "label_name":     None,
            "doc_status":     None,
            "file_type":      None,
            "status":         None,
            "priority":       None,
            "assignee_name":  None,
            "project_name":   None,
            "overdue":        None,
            "assigned_to_me": None,
            "today":          None,
            "date":           None,
            "is_favourite":   None,
            "is_favourite":   None,
        }