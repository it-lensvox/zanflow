"""
LLM Client — wraps AWS Bedrock.

Supports:
  - anthropic.claude-*   → Anthropic Messages API (full tool support)
  - amazon.nova-*        → Amazon Nova converse API (tool support via converse)
  - amazon.titan-*       → Amazon Titan (no tool support)
  - meta.llama*          → Meta Llama (no tool support)

Current model in .env: amazon.nova-lite-v1:0
Nova requires using the Bedrock `converse` API, not `invoke_model`.
"""
import json
import logging
import boto3
from django.conf import settings

logger = logging.getLogger(__name__)


class BedrockLLMClient:

    def __init__(self):
        self.client = boto3.client(
            service_name="bedrock-runtime",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self.model_id = settings.BEDROCK_MODEL_ID
        logger.info("BedrockLLMClient initialised with model: %s", self.model_id)

        if "anthropic.claude" in self.model_id:
            self.model_family = "claude"
        elif "amazon.nova" in self.model_id:
            self.model_family = "nova"
        elif "amazon.titan" in self.model_id:
            self.model_family = "titan"
        elif "meta.llama" in self.model_id:
            self.model_family = "llama"
        else:
            self.model_family = "unknown"

        logger.info("Detected model family: %s", self.model_family)

    def chat(
        self,
        messages: list[dict],
        system_prompt: str,
        tools: list[dict] | None = None,
        max_tokens: int = 1024,
    ) -> dict:
        if self.model_family == "claude":
            return self._chat_claude(messages, system_prompt, tools, max_tokens)
        elif self.model_family == "nova":
            return self._chat_nova(messages, system_prompt, tools, max_tokens)
        elif self.model_family == "titan":
            return self._chat_titan(messages, system_prompt, max_tokens)
        elif self.model_family == "llama":
            return self._chat_llama(messages, system_prompt, max_tokens)
        else:
            raise ValueError(
                f"Unsupported model: {self.model_id}. "
                "Supported: anthropic.claude-*, amazon.nova-*, amazon.titan-*, meta.llama*"
            )

    # ── Amazon Nova — uses Bedrock `converse` API ─────────────────────────────
    # Nova supports tool use via converse, but tool schemas use a different
    # format than Anthropic's format, so we convert them here.

    def _chat_nova(self, messages, system_prompt, tools, max_tokens):
        # converse API expects messages in a specific format
        converse_messages = self._to_converse_messages(messages)

        kwargs = {
            "modelId": self.model_id,
            "system": [{"text": system_prompt}],
            "messages": converse_messages,
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": 0.7,
            },
        }

        # Convert Anthropic-style tool schemas → Bedrock converse tool format
        if tools:
            kwargs["toolConfig"] = {
                "tools": [self._convert_tool_schema(t) for t in tools]
            }

        try:
            response = self.client.converse(**kwargs)
            return self._parse_nova_response(response)
        except Exception as exc:
            logger.exception("Nova converse failed: %s", exc)
            raise

    def _to_converse_messages(self, messages: list[dict]) -> list[dict]:
        """
        Convert our internal message format to Bedrock converse format.
        Converse expects: {"role": "user"|"assistant", "content": [{"text": "..."}]}
        """
        converse_msgs = []
        for m in messages:
            role = m.get("role")
            content = m.get("content")

            # Already in converse list format (tool_use / tool_result blocks)
            if isinstance(content, list):
                converted_blocks = []
                for block in content:
                    if block.get("type") == "tool_use":
                        converted_blocks.append({
                            "toolUse": {
                                "toolUseId": block["id"],
                                "name": block["name"],
                                "input": block["input"],
                            }
                        })
                    elif block.get("type") == "tool_result":
                        converted_blocks.append({
                            "toolResult": {
                                "toolUseId": block["tool_use_id"],
                                "content": [{"text": block["content"]}],
                            }
                        })
                    elif block.get("type") == "text":
                        converted_blocks.append({"text": block["text"]})
                    else:
                        # fallback
                        converted_blocks.append({"text": str(block)})
                converse_msgs.append({"role": role, "content": converted_blocks})
            else:
                # Plain string content
                converse_msgs.append({
                    "role": role,
                    "content": [{"text": str(content)}],
                })

        return converse_msgs

    def _convert_tool_schema(self, tool: dict) -> dict:
        """
        Convert Anthropic tool schema format → Bedrock converse toolSpec format.

        Anthropic format:
          {"name": "...", "description": "...", "input_schema": {...}}

        Bedrock converse format:
          {"toolSpec": {"name": "...", "description": "...", "inputSchema": {"json": {...}}}}
        """
        return {
            "toolSpec": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "inputSchema": {
                    "json": tool.get("input_schema", {"type": "object", "properties": {}})
                },
            }
        }

    def _parse_nova_response(self, response: dict) -> dict:
        """
        Parse Bedrock converse API response into our standard format.
        """
        result = {"stop_reason": "end_turn", "content": "", "tool_use": None}

        stop_reason = response.get("stopReason", "end_turn")
        # Map converse stop reasons to our internal format
        if stop_reason == "tool_use":
            result["stop_reason"] = "tool_use"
        else:
            result["stop_reason"] = "end_turn"

        output_message = response.get("output", {}).get("message", {})
        for block in output_message.get("content", []):
            if "text" in block:
                result["content"] = block["text"]
            elif "toolUse" in block:
                tool = block["toolUse"]
                result["tool_use"] = {
                    "name": tool.get("name"),
                    "id": tool.get("toolUseId"),
                    "input": tool.get("input", {}),
                }

        return result

    # ── Anthropic Claude ──────────────────────────────────────────────────────

    def _chat_claude(self, messages, system_prompt, tools, max_tokens):
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
        if tools:
            body["tools"] = tools

        try:
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
            raw = json.loads(response["body"].read())
            return self._parse_claude_response(raw)
        except Exception as exc:
            logger.exception("Claude invoke_model failed: %s", exc)
            raise

    def _parse_claude_response(self, raw: dict) -> dict:
        stop_reason = raw.get("stop_reason", "end_turn")
        result = {"stop_reason": stop_reason, "content": "", "tool_use": None}
        for block in raw.get("content", []):
            if block.get("type") == "text":
                result["content"] = block.get("text", "")
            elif block.get("type") == "tool_use":
                result["tool_use"] = {
                    "name": block.get("name"),
                    "id": block.get("id"),
                    "input": block.get("input", {}),
                }
        return result

    # ── Amazon Titan ──────────────────────────────────────────────────────────

    def _chat_titan(self, messages, system_prompt, max_tokens):
        prompt = system_prompt + "\n\n"
        for m in messages:
            role = m.get("role", "user").capitalize()
            content = m.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    b.get("text", "") for b in content if isinstance(b, dict)
                )
            prompt += f"{role}: {content}\n"
        prompt += "Assistant:"

        body = {
            "inputText": prompt,
            "textGenerationConfig": {"maxTokenCount": max_tokens, "temperature": 0.7},
        }
        try:
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
            raw = json.loads(response["body"].read())
            text = raw.get("results", [{}])[0].get("outputText", "")
            return {"stop_reason": "end_turn", "content": text.strip(), "tool_use": None}
        except Exception as exc:
            logger.exception("Titan invoke_model failed: %s", exc)
            raise

    # ── Meta Llama ────────────────────────────────────────────────────────────

    def _chat_llama(self, messages, system_prompt, max_tokens):
        prompt = f"<s>[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n"
        for m in messages:
            content = m.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    b.get("text", "") for b in content if isinstance(b, dict)
                )
            if m.get("role") == "user":
                prompt += f"{content} [/INST] "
            else:
                prompt += f"{content} </s><s>[INST] "

        body = {"prompt": prompt, "max_gen_len": max_tokens, "temperature": 0.7}
        try:
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
            raw = json.loads(response["body"].read())
            text = raw.get("generation", "")
            return {"stop_reason": "end_turn", "content": text.strip(), "tool_use": None}
        except Exception as exc:
            logger.exception("Llama invoke_model failed: %s", exc)
            raise


# Module-level singleton
_client_instance = None


def get_llm_client() -> BedrockLLMClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = BedrockLLMClient()
    return _client_instance