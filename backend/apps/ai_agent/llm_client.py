"""
LLM Client — supports AWS Bedrock, OpenAI, Groq, and Google Gemini.

Set LLM_PROVIDER in .env to switch:
  LLM_PROVIDER=openai   → OpenAILLMClient  (gpt-4o-mini recommended)
  LLM_PROVIDER=bedrock  → BedrockLLMClient (Nova Pro / Claude)
  LLM_PROVIDER=groq     → GroqLLMClient    (free — Llama 3.3 70B)
  LLM_PROVIDER=gemini   → GeminiLLMClient  (free — Gemini 2.0 Flash)
"""
import json
import logging
import time
import uuid
import boto3
from django.conf import settings

logger = logging.getLogger(__name__)

_RETRYABLE_ERRORS = {
    "ThrottlingException",
    "ServiceUnavailableException",
    "InternalServerException",
    "ModelTimeoutException",
}


# ── Singleton factory ──────────────────────────────────────────────────────────

_client_instance = None
_client_provider  = None


def get_llm_client():
    """
    Returns the correct LLM client based on LLM_PROVIDER in settings.
    Rebuilds automatically if the provider changes.
    """
    global _client_instance, _client_provider

    provider = getattr(settings, "LLM_PROVIDER", "bedrock").lower().strip()

    if _client_instance is None or _client_provider != provider:
        logger.info("Initialising LLM client for provider: %s", provider)
        if provider == "openai":
            _client_instance = OpenAILLMClient()
        elif provider == "groq":
            _client_instance = GroqLLMClient()
        elif provider == "gemini":
            _client_instance = GeminiLLMClient()
        else:
            _client_instance = BedrockLLMClient()
        _client_provider = provider

    return _client_instance


# ── OpenAI Client ──────────────────────────────────────────────────────────────

class OpenAILLMClient:
    """
    OpenAI API client — best tool use accuracy of all providers.

    Recommended models:
      gpt-4o-mini  — fast, cheap, excellent tool use  ← use this
      gpt-4o       — best quality, higher cost

    Setup:
      pip install openai
      OPENAI_API_KEY=sk-...
      OPENAI_MODEL=gpt-4o-mini
    """

    def __init__(self):
        self.api_key = getattr(settings, "OPENAI_API_KEY", "")
        self.model   = getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
        if not self.api_key:
            raise ValueError(
                "OPENAI_API_KEY is not set. "
                "Get a key at https://platform.openai.com/api-keys"
            )
        logger.info("OpenAILLMClient initialised with model: %s", self.model)

    def chat(
        self,
        messages: list[dict],
        system_prompt: str,
        tools: list[dict] | None = None,
        max_tokens: int = 2048,
    ) -> dict:
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("Run: pip install openai")

        client = OpenAI(api_key=self.api_key)

        # Build OpenAI message format
        openai_messages = [{"role": "system", "content": system_prompt}]
        openai_messages += self._to_openai_messages(messages)

        kwargs = {
            "model":       self.model,
            "messages":    openai_messages,
            "max_tokens":  max_tokens,
            "temperature": 0.2,
        }

        # Convert tools to OpenAI function format
        if tools:
            kwargs["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name":        t["name"],
                        "description": t.get("description", ""),
                        "parameters":  t.get("input_schema", {
                            "type": "object", "properties": {}
                        }),
                    }
                }
                for t in tools
            ]
            kwargs["tool_choice"]         = "auto"
            kwargs["parallel_tool_calls"] = False

        try:
            response = client.chat.completions.create(**kwargs)
            return self._parse_openai_response(response)
        except Exception as exc:
            logger.exception("OpenAI API failed: %s", exc)
            raise

    def _to_openai_messages(self, messages: list[dict]) -> list[dict]:
        """Convert internal message format to OpenAI format."""
        openai_msgs = []
        for m in messages:
            role    = m.get("role")
            content = m.get("content")

            if isinstance(content, list):
                text_parts = []
                tool_call  = None

                for block in content:
                    btype = block.get("type")

                    if btype == "text":
                        text_parts.append(block["text"])

                    elif btype == "tool_use":
                        # Assistant called a tool
                        tool_call = {
                            "id":   block["id"],
                            "type": "function",
                            "function": {
                                "name":      block["name"],
                                "arguments": json.dumps(block["input"]),
                            }
                        }

                    elif btype == "tool_result":
                        # Tool result — must be a separate "tool" role message
                        openai_msgs.append({
                            "role":         "tool",
                            "tool_call_id": block["tool_use_id"],
                            "content":      str(block["content"]),
                        })

                if tool_call:
                    openai_msgs.append({
                        "role":       "assistant",
                        "content":    " ".join(text_parts) if text_parts else None,
                        "tool_calls": [tool_call],
                    })
                elif text_parts:
                    openai_msgs.append({
                        "role":    role,
                        "content": " ".join(text_parts),
                    })
            else:
                openai_msgs.append({"role": role, "content": str(content)})

        return openai_msgs

    def _parse_openai_response(self, response) -> dict:
        """Parse OpenAI response into our standard format."""
        result = {"stop_reason": "end_turn", "content": "", "tool_use": None}

        choice  = response.choices[0]
        message = choice.message
        reason  = choice.finish_reason

        # Tool call
        if reason == "tool_calls" or (hasattr(message, "tool_calls") and message.tool_calls):
            result["stop_reason"] = "tool_use"
            tc = message.tool_calls[0]
            try:
                tool_input = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                logger.warning("Could not parse tool arguments: %s", tc.function.arguments)
                tool_input = {}
            result["tool_use"] = {
                "name":  tc.function.name,
                "id":    tc.id,
                "input": tool_input,
            }

        result["content"] = message.content or ""
        return result


# ── Bedrock Client ─────────────────────────────────────────────────────────────

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
        max_tokens: int = 2048,
    ) -> dict:
        if self.model_family in ("claude", "nova"):
            return self._chat_converse(messages, system_prompt, tools, max_tokens)
        elif self.model_family == "titan":
            return self._chat_titan(messages, system_prompt, max_tokens)
        elif self.model_family == "llama":
            return self._chat_llama(messages, system_prompt, max_tokens)
        else:
            raise ValueError(f"Unsupported model: {self.model_id}")

    def _chat_converse(self, messages, system_prompt, tools, max_tokens):
        converse_messages = self._to_converse_messages(messages)
        temperature = 0.1 if self.model_family == "nova" else 0.3

        kwargs = {
            "modelId":         self.model_id,
            "system":          [{"text": system_prompt}],
            "messages":        converse_messages,
            "inferenceConfig": {
                "maxTokens":   max_tokens,
                "temperature": temperature,
            },
        }

        if tools:
            kwargs["toolConfig"] = {
                "tools": [self._convert_tool_schema(t) for t in tools],
            }

        return self._converse_with_retry(kwargs)

    def _converse_with_retry(self, kwargs: dict, max_attempts: int = 2) -> dict:
        last_exc = None
        for attempt in range(max_attempts):
            try:
                response = self.client.converse(**kwargs)
                return self._parse_converse_response(response)
            except self.client.exceptions.ThrottlingException as exc:
                last_exc = exc
                wait = 2 ** attempt
                logger.warning("Bedrock throttled (attempt %d/%d), retrying in %ss",
                               attempt + 1, max_attempts, wait)
                time.sleep(wait)
            except Exception as exc:
                if type(exc).__name__ in _RETRYABLE_ERRORS and attempt < max_attempts - 1:
                    last_exc = exc
                    wait = 2 ** attempt
                    logger.warning("Transient error '%s', retrying in %ss",
                                   type(exc).__name__, wait)
                    time.sleep(wait)
                else:
                    logger.exception("Converse API failed: %s", exc)
                    raise
        raise last_exc

    def _to_converse_messages(self, messages):
        converse_msgs = []
        for m in messages:
            role    = m.get("role")
            content = m.get("content")
            if isinstance(content, list):
                converted = []
                for block in content:
                    if block.get("type") == "tool_use":
                        converted.append({"toolUse": {
                            "toolUseId": block["id"],
                            "name":      block["name"],
                            "input":     block["input"],
                        }})
                    elif block.get("type") == "tool_result":
                        converted.append({"toolResult": {
                            "toolUseId": block["tool_use_id"],
                            "content":   [{"text": str(block["content"])}],
                        }})
                    elif block.get("type") == "text":
                        converted.append({"text": block["text"]})
                    else:
                        converted.append({"text": str(block)})
                converse_msgs.append({"role": role, "content": converted})
            else:
                converse_msgs.append({"role": role, "content": [{"text": str(content)}]})
        return converse_msgs

    def _convert_tool_schema(self, tool):
        return {
            "toolSpec": {
                "name":        tool["name"],
                "description": tool.get("description", ""),
                "inputSchema": {
                    "json": tool.get("input_schema", {"type": "object", "properties": {}})
                },
            }
        }

    def _parse_converse_response(self, response):
        result         = {"stop_reason": "end_turn", "content": "", "tool_use": None}
        stop_reason    = response.get("stopReason", "end_turn")
        output_message = response.get("output", {}).get("message", {})
        text_parts     = []
        tool_use_block = None

        for block in output_message.get("content", []):
            if "text" in block:
                text_parts.append(block["text"])
            elif "toolUse" in block and tool_use_block is None:
                tool_use_block = block["toolUse"]

        result["content"] = " ".join(text_parts).strip()

        if tool_use_block or stop_reason == "tool_use":
            result["stop_reason"] = "tool_use"
            if tool_use_block:
                result["tool_use"] = {
                    "name":  tool_use_block.get("name"),
                    "id":    tool_use_block.get("toolUseId"),
                    "input": tool_use_block.get("input", {}),
                }
        return result

    def _chat_titan(self, messages, system_prompt, max_tokens):
        prompt = system_prompt + "\n\n"
        for m in messages:
            role    = m.get("role", "user").capitalize()
            content = m.get("content", "")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            prompt += f"{role}: {content}\n"
        prompt += "Assistant:"
        body = {"inputText": prompt,
                "textGenerationConfig": {"maxTokenCount": max_tokens, "temperature": 0.3}}
        try:
            response = self.client.invoke_model(
                modelId=self.model_id, body=json.dumps(body),
                contentType="application/json", accept="application/json")
            raw  = json.loads(response["body"].read())
            text = raw.get("results", [{}])[0].get("outputText", "")
            return {"stop_reason": "end_turn", "content": text.strip(), "tool_use": None}
        except Exception as exc:
            logger.exception("Titan failed: %s", exc)
            raise

    def _chat_llama(self, messages, system_prompt, max_tokens):
        prompt = f"<s>[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n"
        for m in messages:
            content = m.get("content", "")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            prompt += f"{content} [/INST] " if m.get("role") == "user" else f"{content} </s><s>[INST] "
        body = {"prompt": prompt, "max_gen_len": max_tokens, "temperature": 0.3}
        try:
            response = self.client.invoke_model(
                modelId=self.model_id, body=json.dumps(body),
                contentType="application/json", accept="application/json")
            raw  = json.loads(response["body"].read())
            text = raw.get("generation", "")
            return {"stop_reason": "end_turn", "content": text.strip(), "tool_use": None}
        except Exception as exc:
            logger.exception("Llama failed: %s", exc)
            raise


# ── Groq Client ────────────────────────────────────────────────────────────────

class GroqLLMClient:

    def __init__(self):
        self.api_key = getattr(settings, "GROQ_API_KEY", "")
        self.model   = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")
        logger.info("GroqLLMClient initialised with model: %s", self.model)

    def _build_messages(self, messages, system_prompt):
        result = [{"role": "system", "content": system_prompt}]
        for m in messages:
            role    = m.get("role")
            content = m.get("content")
            if isinstance(content, list):
                text_parts, tool_call = [], None
                for block in content:
                    if block.get("type") == "tool_use":
                        tool_call = {"id": block["id"], "type": "function",
                                     "function": {"name": block["name"],
                                                  "arguments": json.dumps(block["input"])}}
                    elif block.get("type") == "tool_result":
                        result.append({"role": "tool",
                                       "tool_call_id": block["tool_use_id"],
                                       "content": str(block["content"])})
                    elif block.get("type") == "text":
                        text_parts.append(block["text"])
                if tool_call:
                    result.append({"role": "assistant",
                                   "content": " ".join(text_parts) or None,
                                   "tool_calls": [tool_call]})
                elif text_parts:
                    result.append({"role": role, "content": " ".join(text_parts)})
            else:
                result.append({"role": role, "content": str(content)})
        return result

    def chat(self, messages, system_prompt, tools=None, max_tokens=2048):
        try:
            from groq import Groq
        except ImportError:
            raise ImportError("Run: pip install groq")

        client = Groq(api_key=self.api_key)
        kwargs = {"model": self.model,
                  "messages": self._build_messages(messages, system_prompt),
                  "max_tokens": max_tokens, "temperature": 0.2}

        if tools:
            kwargs["tools"] = [
                {"type": "function", "function": {
                    "name": t["name"],
                    "description": t.get("description", "")[:300],
                    "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
                }} for t in tools
            ]
            kwargs["tool_choice"]         = "auto"
            kwargs["parallel_tool_calls"] = False

        try:
            response = client.chat.completions.create(**kwargs)
            choice   = response.choices[0]
            message  = choice.message
            result   = {"stop_reason": "end_turn", "content": message.content or "", "tool_use": None}
            if choice.finish_reason == "tool_calls" or (hasattr(message, "tool_calls") and message.tool_calls):
                tc = message.tool_calls[0]
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                result["stop_reason"] = "tool_use"
                result["tool_use"]    = {"name": tc.function.name, "id": tc.id, "input": args}
            return result
        except Exception as exc:
            logger.exception("Groq failed: %s", exc)
            raise


# ── Gemini Client ──────────────────────────────────────────────────────────────

class GeminiLLMClient:

    def __init__(self):
        self.api_key = getattr(settings, "GEMINI_API_KEY", "")
        self.model   = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not set.")
        logger.info("GeminiLLMClient initialised with model: %s", self.model)

    def chat(self, messages, system_prompt, tools=None, max_tokens=2048):
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise ImportError("Run: pip install google-genai")

        client          = genai.Client(api_key=self.api_key)
        gemini_tools    = self._build_tools(tools) if tools else None
        gemini_contents = self._to_contents(messages)
        config_kwargs   = {"system_instruction": system_prompt,
                           "temperature": 0.2, "max_output_tokens": max_tokens}
        if gemini_tools:
            config_kwargs["tools"]       = gemini_tools
            config_kwargs["tool_config"] = types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="AUTO"))
        try:
            response = client.models.generate_content(
                model=self.model, contents=gemini_contents,
                config=types.GenerateContentConfig(**config_kwargs))
            return self._parse(response)
        except Exception as exc:
            logger.exception("Gemini failed: %s", exc)
            raise

    def _to_contents(self, messages):
        from google.genai import types
        contents = []
        for m in messages:
            role    = "model" if m.get("role") == "assistant" else "user"
            content = m.get("content")
            if isinstance(content, list):
                parts = []
                for b in content:
                    if b.get("type") == "text":
                        parts.append(types.Part.from_text(text=b["text"]))
                    elif b.get("type") == "tool_use":
                        parts.append(types.Part.from_function_call(name=b["name"], args=b["input"]))
                    elif b.get("type") == "tool_result":
                        try:
                            data = json.loads(b.get("content", "{}"))
                        except Exception:
                            data = {"result": str(b.get("content", ""))}
                        parts.append(types.Part.from_function_response(
                            name=b.get("name", "tool"), response=data))
                if parts:
                    contents.append(types.Content(role=role, parts=parts))
            else:
                contents.append(types.Content(role=role,
                    parts=[types.Part.from_text(text=str(content))]))
        return contents

    def _build_tools(self, tools):
        from google.genai import types
        def conv(s):
            if not s: return {"type": "object", "properties": {}}
            r = {"type": s.get("type", "object").upper()}
            if "description" in s: r["description"] = s["description"]
            if "enum"        in s: r["enum"]        = s["enum"]
            if s.get("type") == "object" and "properties" in s:
                r["properties"] = {k: conv(v) for k, v in s["properties"].items()}
                if "required" in s: r["required"] = s["required"]
            if s.get("type") == "array" and "items" in s:
                r["items"] = conv(s["items"])
            return r
        return [types.Tool(function_declarations=[
            types.FunctionDeclaration(name=t["name"],
                description=t.get("description", ""),
                parameters=conv(t.get("input_schema", {})))
            for t in tools])]

    def _parse(self, response):
        result = {"stop_reason": "end_turn", "content": "", "tool_use": None}
        if not response.candidates: return result
        text_parts, fc = [], None
        for part in response.candidates[0].content.parts:
            if hasattr(part, "text") and part.text: text_parts.append(part.text)
            if hasattr(part, "function_call") and part.function_call and fc is None: fc = part.function_call
        result["content"] = " ".join(text_parts).strip()
        if fc:
            result["stop_reason"] = "tool_use"
            result["tool_use"]    = {"name": fc.name, "id": str(uuid.uuid4()),
                                     "input": dict(fc.args) if fc.args else {}}
        return result