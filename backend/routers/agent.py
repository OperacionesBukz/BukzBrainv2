"""
Proxy endpoint for LLM providers.
Keys stay server-side, frontend sends messages and gets responses.
"""
import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/agent", tags=["agent"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
TIMEOUT = 60.0


class ChatRequest(BaseModel):
    messages: list[dict]
    tools: list[dict] = []


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Tries Gemini first, falls back to Groq.
    Frontend sends messages + tool definitions, backend proxies to LLM.
    """
    # Try Gemini
    if GEMINI_API_KEY:
        try:
            result = await _call_gemini(req.messages, req.tools)
            return {"provider": "gemini", **result}
        except Exception as e:
            print(f"[agent] Gemini failed: {e}")

    # Fallback to Groq
    if GROQ_API_KEY:
        try:
            result = await _call_groq(req.messages, req.tools)
            return {"provider": "groq", **result}
        except Exception as e:
            print(f"[agent] Groq failed: {e}")

    raise HTTPException(503, "Todos los modelos están ocupados. Intenta en unos minutos.")


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
        raise Exception(f"Gemini {resp.status_code}: {resp.text[:200]}")

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
        raise Exception(f"Groq {resp.status_code}: {resp.text[:200]}")

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
