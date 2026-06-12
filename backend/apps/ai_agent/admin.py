from django.contrib import admin
from apps.ai_agent.models import AgentSession, AgentLog


@admin.register(AgentSession)
class AgentSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "workspace_id", "is_active", "created_at", "updated_at"]
    list_filter = ["is_active", "workspace_id"]
    search_fields = ["user__email", "workspace_id"]
    readonly_fields = ["messages", "created_at", "updated_at"]
    ordering = ["-updated_at"]


@admin.register(AgentLog)
class AgentLogAdmin(admin.ModelAdmin):
    list_display = ["id", "session", "intent", "tool_name", "status", "latency_ms", "created_at"]
    list_filter = ["status", "tool_name", "intent"]
    search_fields = ["user_query", "final_response"]
    readonly_fields = [
        "session", "user_query", "intent", "tool_name", "tool_input",
        "tool_output", "final_response", "status", "error_message",
        "latency_ms", "created_at",
    ]
    ordering = ["-created_at"]