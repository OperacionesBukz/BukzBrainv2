import type { LLMProvider, ProviderResponse, ToolCall } from "../types";
import { toolsToGeminiFormat, type ProviderConfig } from "./types";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function createGeminiProvider(config: ProviderConfig): LLMProvider {
  const model = config.model ?? "gemini-2.0-flash";

  return {
    name: "gemini",
    async sendMessage(messages, tools, signal) {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${config.apiKey}`;

      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const body: Record<string, unknown> = { contents };
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
