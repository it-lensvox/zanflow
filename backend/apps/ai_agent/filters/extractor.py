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
  "search" → user wants to FIND or VIEW something
             (show, list, find, search, who, what, how many, display, get)
  "action" → user wants to DO something
             (create, update, delete, assign, mark, move, add, change, remove, defer)

Return ONLY valid JSON with a single key. No explanation. No markdown.
{"intent": "search"}  OR  {"intent": "action"}"""

_FILTER_SYSTEM_PROMPT = """You are a search filter extractor for Dyuksa, a project management app.

Extract structured filters from the user query and return ONLY valid JSON.
No explanation. No markdown. No extra keys.

Valid status values  : pending, in_progress, completed, review, deployed, deferred, backlog
Valid priority values: low, medium, high, critical
Aliases to map       : urgent→critical, done→completed, started→in_progress, overdue→check overdue field
Valid models         : task, note, project, event
Favourite aliases    : favourite, favorite, starred, bookmarked, saved → set is_favourite=true

JSON schema (use null for any field not mentioned in the query):
{
  "models":         ["task"|"note"|"project"|"event"],  // which models to search
  "search_text":    "string | null",            // keyword in heading/title/description
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
  "show everything about ZanFlow"     → models=["task","note","project","event"], project_name="ZanFlow"
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
            "models":         result.get("models", ["task", "note", "project", "event"]),
            "search_text":    result.get("search_text"),
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
            "models":         ["task", "note", "project", "event"],
            "search_text":    query,
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
