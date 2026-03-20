import type { ProviderResponse, ToolDefinition } from "./types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

export async function sendToLLM(
  messages: { role: string; content: string }[],
  tools: ToolDefinition[]
): Promise<ProviderResponse & { provider: string }> {
  // Convert tool definitions to the format the backend expects (JSON Schema only, no execute fn)
  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const res = await fetch(`${BACKEND_URL}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, tools: toolDefs }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[agent] Backend error:", res.status, errText);
    throw new Error("Error al conectar con el asistente. Intenta de nuevo.");
  }

  const data = await res.json();
  return {
    message: data.message ?? "",
    toolCalls: data.toolCalls ?? [],
    provider: data.provider ?? "backend",
  };
}
