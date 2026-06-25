from rest_framework import serializers
from apps.ai_agent.models import AgentSession, AgentLog


class AgentQuerySerializer(serializers.Serializer):
    """Validates the incoming POST body for /agent/query/"""
    query = serializers.CharField(
        max_length=2000,
        allow_blank=True,  # blank handled gracefully in views.py
        help_text="The natural language query or command from the user",
    )
    session_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional: pass an existing session_id to continue a conversation",
    )


class AgentResponseSerializer(serializers.Serializer):
    """Shapes the response returned to the frontend"""
    response = serializers.CharField()
    session_id = serializers.IntegerField()
    tool_called = serializers.CharField(allow_null=True)
    tool_result = serializers.DictField(allow_null=True)


class AgentSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSession
        fields = ["id", "workspace_id", "messages", "created_at", "updated_at", "is_active"]
        read_only_fields = fields


class AgentLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentLog
        fields = [
            "id", "user_query", "intent", "tool_name", "tool_input",
            "tool_output", "final_response", "status", "latency_ms", "created_at",
        ]
        read_only_fields = fields