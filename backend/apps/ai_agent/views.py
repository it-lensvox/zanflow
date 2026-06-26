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
        )[:20]
        serializer = AgentSessionSerializer(sessions, many=True)
        return Response(serializer.data)


class AgentSessionDetailView(APIView):
    """
    GET    /api/v1/agent/sessions/<session_id>/  — returns session + message history
    DELETE /api/v1/agent/sessions/<session_id>/  — closes the session

    Closes/clears a session so it won't appear in the list.
    Does not delete the logs — they're kept for audit.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = AgentSession.objects.get(
                id=session_id,
                user=request.user,
            )
            return Response({
                "id": session.id,
                "is_active": session.is_active,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "messages": session.messages,  # full conversation history
            })
        except AgentSession.DoesNotExist:
            return Response({"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

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