from django.urls import path
from apps.ai_agent.views import (
    AgentQueryView,
    AgentSessionListView,
    AgentSessionDetailView,
    AgentSessionLogsView,
)

app_name = "ai_agent"

urlpatterns = [
    # Main agent endpoint — frontend sends every query here
    path("query/", AgentQueryView.as_view(), name="agent-query"),

    # Session management
    path("sessions/", AgentSessionListView.as_view(), name="session-list"),
    path("sessions/<int:session_id>/", AgentSessionDetailView.as_view(), name="session-detail"),
    path("sessions/<int:session_id>/logs/", AgentSessionLogsView.as_view(), name="session-logs"),
]