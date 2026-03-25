"""
Proxy endpoint for LLM providers.
Keys stay server-side, frontend sends messages and gets responses.
"""
import os
import asyncio
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/agent", tags=["agent"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
TIMEOUT = 90.0
MAX_RETRIES = 3
RETRY_DELAYS = [1, 3, 8]  # seconds between retries


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
    return {
        "status": "ok",
        "providers": providers,
        "hasKeys": len(providers) > 0,
    }


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Tries Gemini first, falls back to Groq.
    Both providers have retry logic for transient errors.
    """
    errors: list[str] = []

    # Try Gemini
    if GEMINI_API_KEY:
        try:
            result = await _call_with_retry(_call_gemini, req.messages, req.tools, "Gemini")
            return {"provider": "gemini", **result}
        except Exception as e:
            errors.append(f"Gemini: {e}")
            print(f"[agent] Gemini failed after retries: {e}")
    else:
        errors.append("Gemini: API key no configurada")
        print("[agent] Gemini: API key no configurada")

    # Fallback to Groq
    if GROQ_API_KEY:
        try:
            result = await _call_with_retry(_call_groq, req.messages, req.tools, "Groq")
            return {"provider": "groq", **result}
        except Exception as e:
            errors.append(f"Groq: {e}")
            print(f"[agent] Groq failed after retries: {e}")
    else:
        errors.append("Groq: API key no configurada")
        print("[agent] Groq: API key no configurada")

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
            is_retryable = False
            for code in (429, 500, 502, 503, 529):
                if str(code) in err_str:
                    is_retryable = True
                    break

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

    body: dict = {"contents": contents}

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


async def _call_groq(messages: list[dict], tools: list[dict]) -> dict:
    body: dict = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }

    if tools:
        body["tools"] = [
            {"type": "function", "function": t} for t in tools
        ]
        body["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            GROQ_URL,
            json=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}",
            },
        )

    if resp.status_code != 200:
        raise Exception(f"HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    choice = data.get("choices", [{}])[0].get("message", {})

    tool_calls = []
    for tc in choice.get("tool_calls", []):
        import json
        tool_calls.append({
            "name": tc["function"]["name"],
            "params": json.loads(tc["function"]["arguments"]),
        })

    return {"message": choice.get("content", "") or "", "toolCalls": tool_calls}
