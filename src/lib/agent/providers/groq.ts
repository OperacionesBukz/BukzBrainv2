import type { LLMProvider, ProviderResponse, ToolCall } from "../types";
import { toolsToOpenAIFormat, type ProviderConfig } from "./types";

export function createGroqProvider(config: ProviderConfig): LLMProvider {
  const model = config.model ?? "llama-3.3-70b-versatile";

  return {
    name: "groq",
    async sendMessage(messages, tools, signal) {
      const body: Record<string, unknown> = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (tools.length > 0) {
        body.tools = toolsToOpenAIFormat(tools);
        body.tool_choice = "auto";
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.warn("[agent] Groq error body:", errBody);
        throw new Error(`Groq error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message;

      const toolCalls: ToolCall[] = (choice?.tool_calls ?? []).map(
        (tc: { function: { name: string; arguments: string } }) => ({
          name: tc.function.name,
          params: JSON.parse(tc.function.arguments),
        })
      );

      return { message: choice?.content ?? "", toolCalls } satisfies ProviderResponse;
    },
  };
}
