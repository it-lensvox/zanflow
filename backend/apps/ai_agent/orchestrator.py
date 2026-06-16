"""
AgentOrchestrator — the brain of the Dyuksa AI agent.
"""
import json
import logging
import re
import time
from datetime import date

from apps.ai_agent.llm_client import get_llm_client
from apps.ai_agent.models import AgentSession, AgentLog
from apps.ai_agent.prompts import AGENT_SYSTEM_PROMPT
from apps.ai_agent.tools.registry import ALL_TOOL_SCHEMAS, execute_tool

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 5


def _clean_response(text: str) -> str:
    """
    Strip internal model tags that should never reach the user.

    Handles three cases:
    1. Closed tags:   <thinking>...</thinking>  → remove entire block
    2. Unclosed tags: <thinking>...             → remove from tag to end
                      (Nova sometimes emits an opening tag with no closing tag,
                       which was causing responses to be cut off mid-sentence)
    3. Leading tags:  response starts with <thinking> content </thinking> real reply
                      → strip the thinking block, keep the real reply
    """
    # Case 1 — remove fully closed thinking blocks
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL)
    text = re.sub(r"<antThinking>.*?</antThinking>", "", text, flags=re.DOTALL)

    # Case 2 — remove unclosed opening tags and everything after them
    # This prevents "User: in the Dyuksa project" style truncation
    text = re.sub(r"<thinking>.*$", "", text, flags=re.DOTALL)
    text = re.sub(r"<antThinking>.*$", "", text, flags=re.DOTALL)

    # Clean up any leftover whitespace from tag removal
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class AgentOrchestrator:

    def __init__(self, user, workspace_id: str, session_id: int | None = None):
        self.user = user
        self.workspace_id = workspace_id
        self.llm = get_llm_client()
        self.session = self._get_or_create_session(session_id)

    def run(self, user_query: str) -> dict:
        start = time.time()
        log = AgentLog(session=self.session, user_query=user_query)

        try:
            # 1. Add user message to history
            self.session.add_message("user", user_query)

            # 2. Build system prompt — inject current user context
            system_prompt = self._build_system_prompt()

            # 3. First LLM call
            llm_response = self.llm.chat(
                messages=self.session.messages,
                system_prompt=system_prompt,
                tools=ALL_TOOL_SCHEMAS,
            )

            tool_called = None
            tool_result = None

            # 4. Agentic loop
            rounds = 0
            while llm_response["stop_reason"] == "tool_use" and rounds < MAX_TOOL_ROUNDS:
                rounds += 1
                tool_use = llm_response["tool_use"]
                tool_name = tool_use["name"]
                tool_input = tool_use["input"]

                logger.info(
                    "Agent calling tool '%s' with args: %s",
                    tool_name, json.dumps(tool_input, default=str),
                )

                # Resolve "me" / "myself" → current user's email automatically
                # so the LLM never needs to ask "what is your email?"
                for key in ("assigned_to_email", "assignee_email"):
                    if tool_input.get(key, "").lower() in ("me", "myself", "i"):
                        tool_input[key] = self.user.email

                tool_result = execute_tool(tool_name, tool_input, self.user, self.workspace_id)
                tool_called = tool_name

                log.tool_name = tool_name
                log.tool_input = tool_input
                log.tool_output = tool_result

                # Append tool call + result to conversation history
                self.session.messages.append({
                    "role": "assistant",
                    "content": [
                        {
                            "type": "tool_use",
                            "id": tool_use["id"],
                            "name": tool_name,
                            "input": tool_input,
                        }
                    ],
                })
                self.session.messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use["id"],
                            "content": json.dumps(tool_result, default=str),
                        }
                    ],
                })
                self.session.save(update_fields=["messages", "updated_at"])

                # Call LLM again with the tool result
                llm_response = self.llm.chat(
                    messages=self.session.messages,
                    system_prompt=system_prompt,
                    tools=ALL_TOOL_SCHEMAS,
                )

            # 5. Clean and return final response
            final_response = _clean_response(llm_response.get("content", ""))
            if not final_response:
                final_response = "Done."

            self.session.add_message("assistant", final_response)

            log.intent = tool_called or "direct_answer"
            log.final_response = final_response
            log.status = AgentLog.Status.TOOL_CALLED if tool_called else AgentLog.Status.SUCCESS
            log.latency_ms = int((time.time() - start) * 1000)
            log.save()

            return {
                "response": final_response,
                "session_id": self.session.id,
                "tool_called": tool_called,
                "tool_result": tool_result,
            }

        except Exception as exc:
            logger.exception("AgentOrchestrator.run failed: %s", exc)
            log.status = AgentLog.Status.ERROR
            log.error_message = str(exc)
            log.latency_ms = int((time.time() - start) * 1000)
            log.save()
            raise

    def _get_or_create_session(self, session_id: int | None) -> AgentSession:
        if session_id:
            try:
                return AgentSession.objects.get(
                    id=session_id,
                    user=self.user,
                    workspace_id=self.workspace_id,
                    is_active=True,
                )
            except AgentSession.DoesNotExist:
                logger.warning("Session %s not found, creating new one", session_id)

        return AgentSession.objects.create(
            user=self.user,
            workspace_id=self.workspace_id,
            messages=[],
        )

    def _build_system_prompt(self) -> str:
        return AGENT_SYSTEM_PROMPT.format(
            user_name=self.user.get_full_name() or self.user.email,
            user_email=self.user.email,
            workspace_id=self.workspace_id,
            current_date=date.today().isoformat(),
        )