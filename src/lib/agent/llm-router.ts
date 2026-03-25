import type { ProviderResponse, ToolDefinition } from "./types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // ms

export async function sendToLLM(
  messages: { role: string; content: string }[],
  tools: ToolDefinition[]
): Promise<ProviderResponse & { provider: string }> {
  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BACKEND_URL}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, tools: toolDefs }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let detail = "Error al conectar con el asistente.";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.detail) detail = parsed.detail;
        } catch { /* no parseable detail */ }

        // Retry on 503 (models busy) or 502/504 (proxy errors)
        if ([502, 503, 504].includes(res.status) && attempt < MAX_RETRIES - 1) {
          console.warn(`[agent] Backend ${res.status}, reintentando en ${RETRY_DELAYS[attempt]}ms... (intento ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(RETRY_DELAYS[attempt]);
          lastError = new Error(detail);
          continue;
        }

        console.warn("[agent] Backend error:", res.status, errText);
        throw new Error(detail);
      }

      const data = await res.json();
      return {
        message: data.message ?? "",
        toolCalls: data.toolCalls ?? [],
        provider: data.provider ?? "backend",
      };
    } catch (err) {
      const isNetworkError = err instanceof TypeError && (
        err.message.includes("fetch") ||
        err.message.includes("network") ||
        err.message.includes("Failed")
      );

      if (isNetworkError && attempt < MAX_RETRIES - 1) {
        console.warn(`[agent] Error de red, reintentando en ${RETRY_DELAYS[attempt]}ms... (intento ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(RETRY_DELAYS[attempt]);
        lastError = new Error("No se pudo conectar con el servidor. Verificando conexión...");
        continue;
      }

      // If it's a network error on the last attempt, give a clear message
      if (isNetworkError) {
        throw new Error(
          "No se pudo conectar con el servidor del asistente. " +
          "Puede que el servidor esté reiniciándose. Intenta de nuevo en unos segundos."
        );
      }

      // Re-throw non-network errors (like our own thrown errors above)
      throw err;
    }
  }

  throw lastError ?? new Error("Error desconocido al conectar con el asistente.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
