"""
AI Agent views.

Endpoints:
  POST   /api/v1/agent/query/              — main agent endpoint
  GET    /api/v1/agent/sessions/           — list user's sessions
  DELETE /api/v1/agent/sessions/<id>/      — clear/close a session
  GET    /api/v1/agent/sessions/<id>/logs/ — view logs for a session
"""
import logging

import json
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_agent.models import AgentSession, AgentLog
from apps.ai_agent.orchestrator import AgentOrchestrator
from apps.ai_agent.serializers import (
    AgentQuerySerializer,
    AgentSessionSerializer,
    AgentLogSerializer,
)

logger = logging.getLogger(__name__)


def get_workspace_id(request) -> str:
    """
    Read workspace_id from the x-workspace-id header.
    Your TenantMiddleware already validates this — we just read it.
    """
    workspace_id = request.headers.get("X-Workspace-Id") or request.META.get(
        "HTTP_X_WORKSPACE_ID", ""
    )
    return str(workspace_id).strip()


class AgentQueryView(APIView):
    """
    POST /api/v1/agent/query/

    Body:
        { "query": "create a task for Priya", "session_id": null }

    Response:
        {
            "response": "Done — task created and assigned to Priya.",
            "session_id": 42,
            "tool_called": "create_task",
            "tool_result": {...}
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AgentQuerySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data["query"]
        session_id = serializer.validated_data.get("session_id")
        workspace_id = get_workspace_id(request)

        # Q071: handle blank/empty query gracefully instead of crashing
        if not query or not query.strip():
            return Response(
                {
                    "response": "It looks like your message was empty. What would you like to do?",
                    "session_id": session_id,
                    "tool_called": None,
                    "tool_result": None,
                },
                status=status.HTTP_200_OK,
            )

        if not workspace_id:
            return Response(
                {"error": "X-Workspace-Id header is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            orchestrator = AgentOrchestrator(
                user=request.user,
                workspace_id=workspace_id,
                session_id=session_id,
            )
            result = orchestrator.run(query)
            return Response(result, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.exception("Agent query failed for user %s: %s", request.user.id, exc)
            return Response(
                {"error": "The agent encountered an error. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AgentQueryStreamView(APIView):
    """
    POST /api/v1/agent/query/stream/

    SSE streaming endpoint. Same request body as /query/.
    Response is text/event-stream — each line is a JSON event:

      data: {"type": "chunk", "text": "Task "}
      data: {"type": "chunk", "text": "'Fix login bug'"}
      data: {"type": "done",  "session_id": 42, "tool_called": "create_task", "tool_result": {...}}
      data: {"type": "error", "message": "..."}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AgentQuerySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query        = serializer.validated_data["query"]
        session_id   = serializer.validated_data.get("session_id")
        workspace_id = get_workspace_id(request)

        if not workspace_id:
            return Response(
                {"error": "X-Workspace-Id header is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not query or not query.strip():
            def empty_stream():
                yield f"data: {json.dumps({'type': 'chunk', 'text': 'What would you like to do?'})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'session_id': None, 'tool_called': None, 'tool_result': None})}\n\n"
            return StreamingHttpResponse(empty_stream(), content_type="text/event-stream")

        def event_stream():
            try:
                orchestrator = AgentOrchestrator(
                    user=request.user,
                    workspace_id=workspace_id,
                    session_id=session_id,
                )
                for event in orchestrator.run_stream(query):
                    yield f"data: {json.dumps(event)}\n\n"
            except Exception as exc:
                logger.exception("Streaming failed: %s", exc)
                yield f"data: {json.dumps({'type': 'error', 'message': 'The agent encountered an error.'})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"]               = "no-cache"
        response["X-Accel-Buffering"]           = "no"  # disable nginx buffering
        response["Access-Control-Allow-Origin"] = "*"
        return response


class AgentSessionListView(APIView):
    """
    GET /api/v1/agent/sessions/

    Returns the last 20 active sessions for the current user in this workspace.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = get_workspace_id(request)
        sessions = AgentSession.objects.filter(
            user=request.user,
            workspace_id=workspace_id,
            is_active=True,
        ).order_by("-is_pinned", "-updated_at")[:50]

        return Response([
            {
                "id":         s.id,
                "title":      s.title or f"Session {s.id}",
                "is_pinned":  s.is_pinned,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
            }
            for s in sessions
        ])


class AgentSessionDetailView(APIView):
    """
    GET    /api/v1/agent/sessions/<session_id>/         — session + message history
    PATCH  /api/v1/agent/sessions/<session_id>/         — rename or pin/unpin
    DELETE /api/v1/agent/sessions/<session_id>/         — soft delete session
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = AgentSession.objects.get(
                id=session_id,
                user=request.user,
            )
            return Response({
                "id":         session.id,
                "title":      session.title or f"Session {session.id}",
                "is_active":  session.is_active,
                "is_pinned":  session.is_pinned,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "messages":   session.messages,
            })
        except AgentSession.DoesNotExist:
            return Response({"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, session_id):
        """
        Rename or pin/unpin a session.

        Body (any combination):
            { "title": "My renamed chat" }
            { "is_pinned": true }
            { "title": "New name", "is_pinned": false }
        """
        try:
            session = AgentSession.objects.get(
                id=session_id,
                user=request.user,
            )
        except AgentSession.DoesNotExist:
            return Response({"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        updated_fields = []

        # Rename
        if "title" in request.data:
            title = str(request.data["title"]).strip()
            if not title:
                return Response(
                    {"error": "title cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            session.title = title[:255]
            updated_fields.append("title")

        # Pin / Unpin
        if "is_pinned" in request.data:
            session.is_pinned = bool(request.data["is_pinned"])
            updated_fields.append("is_pinned")

        if not updated_fields:
            return Response(
                {"error": "Provide at least one of: title, is_pinned"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_fields.append("updated_at")
        session.save(update_fields=updated_fields)

        return Response({
            "id":        session.id,
            "title":     session.title,
            "is_pinned": session.is_pinned,
        })

    def delete(self, request, session_id):
        try:
            session = AgentSession.objects.get(
                id=session_id,
                user=request.user,
            )
            session.is_active = False
            session.save(update_fields=["is_active"])
            return Response({"message": "Session closed."}, status=status.HTTP_200_OK)
        except AgentSession.DoesNotExist:
            return Response({"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND)


class AgentSessionLogsView(APIView):
    """
    GET /api/v1/agent/sessions/<session_id>/logs/

    Returns all logs (query → tool → response) for a session.
    Useful for debugging and showing history in the UI.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = AgentSession.objects.get(
                id=session_id,
                user=request.user,
            )
            logs = AgentLog.objects.filter(session=session).order_by("created_at")
            serializer = AgentLogSerializer(logs, many=True)
            return Response(serializer.data)
        except AgentSession.DoesNotExist:
            return Response({"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

class AISearchView(APIView):
    """
    POST /api/v1/agent/search/

    Classifies query intent then either:
      - Runs AI-powered filtered search (intent=search)
      - Returns action hint for frontend to open in chat (intent=action)

    Body:
        { "query": "critical bugs assigned to Ravi" }

    Response (search):
        {
            "type":     "search",
            "query":    "critical bugs assigned to Ravi",
            "results":  {"tasks": [...], "notes": [...], "projects": [...]},
            "total":    5,
            "fallback": false
        }

    Response (action):
        {
            "type":    "action",
            "query":   "create a task called Fix login bug",
            "message": "It looks like you want to perform an action."
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = (request.data.get("query") or "").strip()

        if not query:
            return Response(
                {"error": "query is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace_id = get_workspace_id(request)
        if not workspace_id:
            return Response(
                {"error": "X-Workspace-Id header is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.ai_agent.search.intent import classify_intent, extract_filters
            from apps.ai_agent.search.query_builder import run_search

            # Step 1 — classify intent
            intent = classify_intent(query)

            # Step 2a — action intent: return hint, let frontend open chat
            if intent == "action":
                return Response({
                    "type":    "action",
                    "query":   query,
                    "message": "It looks like you want to perform an action.",
                })

            # Step 2b — search intent: extract filters and run ORM search
            fallback = False
            filters   = extract_filters(query)
            page      = int(request.data.get("page", 1))
            page_size = min(int(request.data.get("page_size", 10)), 50)

            # If filter extraction failed, extract_filters already returned
            # a safe keyword-only fallback — check if it's a fallback
            if not any([
                filters.get("status"), filters.get("priority"),
                filters.get("assignee_name"), filters.get("project_name"),
                filters.get("overdue"), filters.get("assigned_to_me"),
                filters.get("today"), filters.get("date"),
                filters.get("search_text"), filters.get("is_favourite"),
            ]):
                fallback = True

            search_output = run_search(
                filters, request.user, workspace_id,
                page=page, page_size=page_size,
            )

            # Build filters_used — same shape as chat agent's filters_used,
            # using project_id instead of project_name for consistency
            # with how the chat agent (list_tasks tool) already works.s
            filters_for_response = {
                k: v for k, v in filters.items()
                if v is not None and k not in ("models", "project_name")
            }
            if search_output.get("resolved_project_id"):
                filters_for_response["project_id"] = search_output["resolved_project_id"]
            elif filters.get("project_name"):
                # Could not resolve to an ID — keep the name as fallback
                # so frontend still has something usable
                filters_for_response["project_name"] = filters["project_name"]

            return Response({
                "type":         "search",
                "query":        query,
                "results":      search_output["results"],
                "totals":       search_output["totals"],
                "total":        search_output["total"],
                "page":         search_output["page"],
                "page_size":    search_output["page_size"],
                "has_more":     search_output["has_more"],
                "filters_used": filters_for_response,
                "fallback":     fallback,
            })

        except Exception as exc:
            # Full fallback — use existing search_workspace tool unchanged
            logger.exception("AISearchView failed, falling back to basic search: %s", exc)
            try:
                from apps.ai_agent.tools.search_tools import search_workspace
                result = search_workspace(
                    {"query": query, "content_types": ["tasks", "notes", "projects"]},
                    request.user,
                    workspace_id,
                )
                return Response({
                    "type":     "search",
                    "query":    query,
                    "results":  result.get("results", {}),
                    "total":    result.get("total_results", 0),
                    "fallback": True,
                })
            except Exception:
                return Response(
                    {"error": "Search failed. Please try again."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )