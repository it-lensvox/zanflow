from django.db import models

# Create your models here.
from django.db import models
from django.conf import settings


class AgentSession(models.Model):
    """
    Stores the full conversation history for a single user session
    with the AI agent. Each session belongs to one user and one workspace.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE, 
        related_name="agent_sessions",
    )
    # Workspace ID matches the x-workspace-id header your TenantMiddleware reads
    workspace_id = models.CharField(max_length=255, db_index=True)
    # Full message history as JSON: [{"role": "user", "content": "..."}, ...]
    messages = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active  = models.BooleanField(default=True)
    is_pinned  = models.BooleanField(default=False)
    title      = models.CharField(
        max_length=255,
        blank=True,
        help_text="Auto-generated from first message or manually renamed by user",
    )

    class Meta:
        ordering = ["-is_pinned", "-updated_at"]  # pinned sessions appear first
        indexes = [
            models.Index(fields=["user", "workspace_id"]),
        ]

    def __str__(self):
        return f"Session({self.user_id}, ws={self.workspace_id}, msgs={len(self.messages)})"

    def add_message(self, role: str, content: str):
        """Append a message and save."""
        self.messages.append({"role": role, "content": content})
        self.save(update_fields=["messages", "updated_at"])


class AgentLog(models.Model):
    """
    One row per agent invocation. Records what the user asked,
    which tool (if any) was called, and the final answer returned.
    Useful for debugging and future fine-tuning.
    """
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        TOOL_CALLED = "tool_called", "Tool Called"
        ERROR = "error", "Error"

    session = models.ForeignKey(
        AgentSession,
        on_delete=models.CASCADE,
        related_name="logs",
    )
    user_query = models.TextField()
    intent = models.CharField(max_length=100, blank=True)   # e.g. "create_task"
    tool_name = models.CharField(max_length=100, blank=True) # e.g. "create_task"
    tool_input = models.JSONField(null=True, blank=True)     # args passed to tool
    tool_output = models.JSONField(null=True, blank=True)    # what the tool returned
    final_response = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUCCESS,
    )
    error_message = models.TextField(blank=True)
    latency_ms = models.IntegerField(default=0)              # total round-trip time
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Log({self.intent or 'unknown'}, {self.status}, {self.created_at:%Y-%m-%d %H:%M})"