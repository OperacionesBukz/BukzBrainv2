import type { LLMProvider, ProviderResponse, ToolCall } from "../types";
import { toolsToGeminiFormat, type ProviderConfig } from "./types";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function createGeminiProvider(config: ProviderConfig): LLMProvider {
  const model = config.model ?? "gemini-2.5-flash";

  return {
    name: "gemini",
    async sendMessage(messages, tools, signal) {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${config.apiKey}`;

      // Gemini uses systemInstruction for system messages, not in contents
      const systemMsg = messages.find((m) => m.role === "system");
      const nonSystemMsgs = messages.filter((m) => m.role !== "system");

      const contents = nonSystemMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const body: Record<string, unknown> = { contents };
      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }
      if (tools.length > 0) {
        body.tools = toolsToGeminiFormat(tools);
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.warn("[agent] Gemini error body:", errBody);
        throw new Error(`Gemini error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts ?? [];

      let message = "";
      const toolCalls: ToolCall[] = [];

      for (const part of parts) {
        if (part.text) message += part.text;
        if (part.functionCall) {
          toolCalls.push({
            name: part.functionCall.name,
            params: part.functionCall.args ?? {},
          });
        }
      }

      return { message, toolCalls } satisfies ProviderResponse;
    },
  };
}
