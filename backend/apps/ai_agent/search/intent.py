"""
apps/ai_agent/search/intent.py

This file now re-exports from the shared filters module to avoid
duplicating filter extraction logic in two places.

The actual implementation lives in apps/ai_agent/filters/extractor.py
and is shared with the chat agent (orchestrator.py) as well.

NO BEHAVIOR CHANGE — classify_intent() and extract_filters() work
exactly as before. This file is kept so existing imports
(`from apps.ai_agent.search.intent import classify_intent, extract_filters`)
continue to work without any changes needed elsewhere.
"""
from apps.ai_agent.filters.extractor import classify_intent, extract_filters

__all__ = ["classify_intent", "extract_filters"]