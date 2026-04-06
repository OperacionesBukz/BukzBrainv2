"""
Proxy endpoint for LLM providers.
Keys stay server-side, frontend sends messages and gets responses.
"""
import os
import json
import asyncio
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/agent", tags=["agent"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
TIMEOUT = 90.0
MAX_RETRIES = 3
RETRY_DELAYS = [1, 3, 8]  # seconds between retries

# LLM generation settings
MAX_TOKENS = 2048
TEMPERATURE = 0.3  # Low for reliable tool calling


class ChatRequest(BaseModel):
    messages: list[dict]
    tools: list[dict] = []


@router.get("/health")
async def health():
    """Health check: returns backend status and which LLM providers are configured."""
    providers = []
    if GEMINI_API_KEY:
        providers.append("gemini")
    if GROQ_API_KEY:
        providers.append("groq")
    if OPENROUTER_API_KEY:
        providers.append("openrouter")
    if CEREBRAS_API_KEY:
        providers.append("cerebras")
    return {
        "status": "ok",
        "providers": providers,
        "hasKeys": len(providers) > 0,
    }


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Tries Gemini first, falls back to Groq, OpenRouter, Cerebras.
    All providers have retry logic for transient errors.
    """
    errors: list[str] = []

    providers = [
        ("gemini", GEMINI_API_KEY, _call_gemini),
        ("groq", GROQ_API_KEY, lambda m, t: _call_openai_compatible(GROQ_URL, GROQ_API_KEY, "llama-3.3-70b-versatile", m, t)),
        ("openrouter", OPENROUTER_API_KEY, lambda m, t: _call_openai_compatible(OPENROUTER_URL, OPENROUTER_API_KEY, "meta-llama/llama-3.3-70b-instruct", m, t)),
        ("cerebras", CEREBRAS_API_KEY, lambda m, t: _call_openai_compatible(CEREBRAS_URL, CEREBRAS_API_KEY, "llama-3.3-70b", m, t)),
    ]

    for name, api_key, call_fn in providers:
        if not api_key:
            errors.append(f"{name}: API key no configurada")
            print(f"[agent] {name}: API key no configurada")
            continue
        try:
            result = await _call_with_retry(call_fn, req.messages, req.tools, name)
            return {"provider": name, **result}
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"[agent] {name} failed after retries: {e}")

    detail = " | ".join(errors)
    print(f"[agent] Todos los modelos fallaron: {detail}")
    raise HTTPException(503, f"Todos los modelos están ocupados. Detalle: {detail}")


def _is_retryable(status_code: int) -> bool:
    """Check if an HTTP status code is worth retrying."""
    return status_code in (429, 500, 502, 503, 529)


async def _call_with_retry(fn, messages, tools, provider_name: str):
    """Call an LLM provider function with exponential backoff retry."""
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            return await fn(messages, tools)
        except Exception as e:
            last_error = e
            err_str = str(e)

            # Check if it's a retryable HTTP error
            is_retryable = any(str(code) in err_str for code in (429, 500, 502, 503, 529))

            # Also retry on timeouts and connection errors
            if "timeout" in err_str.lower() or "connect" in err_str.lower():
                is_retryable = True

            if not is_retryable or attempt == MAX_RETRIES - 1:
                raise

            delay = RETRY_DELAYS[attempt]
            print(f"[agent] {provider_name} attempt {attempt + 1} failed ({err_str}), retrying in {delay}s...")
            await asyncio.sleep(delay)

    raise last_error


async def _call_gemini(messages: list[dict], tools: list[dict]) -> dict:
    # Separate system message
    system_msg = next((m for m in messages if m.get("role") == "system"), None)
    non_system = [m for m in messages if m.get("role") != "system"]

    contents = []
    for m in non_system:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    body: dict = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": MAX_TOKENS,
            "temperature": TEMPERATURE,
        },
    }

    if system_msg:
        body["systemInstruction"] = {"parts": [{"text": system_msg["content"]}]}

    if tools:
        body["tools"] = [{"functionDeclarations": tools}]

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json=body,
            headers={"Content-Type": "application/json"},
        )

    if resp.status_code != 200:
        raise Exception(f"HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])

    message = ""
    tool_calls = []
    for part in parts:
        if "text" in part:
            message += part["text"]
        if "functionCall" in part:
            tool_calls.append({
                "name": part["functionCall"]["name"],
                "params": part["functionCall"].get("args", {}),
            })

    return {"message": message, "toolCalls": tool_calls}


async def _call_openai_compatible(
    url: str, api_key: str, model: str,
    messages: list[dict], tools: list[dict]
) -> dict:
    """Unified handler for OpenAI-compatible APIs (Groq, OpenRouter, Cerebras)."""
    body: dict = {
        "model": model,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
    }

    if tools:
        body["tools"] = [{"type": "function", "function": t} for t in tools]
        body["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            url,
            json=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )

    if resp.status_code != 200:
        raise Exception(f"HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    choice = data.get("choices", [{}])[0].get("message", {})

    tool_calls = []
    for tc in choice.get("tool_calls", []):
        tool_calls.append({
            "name": tc["function"]["name"],
            "params": json.loads(tc["function"]["arguments"]),
        })

    return {"message": choice.get("content", "") or "", "toolCalls": tool_calls}
