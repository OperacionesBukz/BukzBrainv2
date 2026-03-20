import type { LLMProvider, ProviderResponse, ToolCall } from "../types";
import { toolsToOpenAIFormat, type ProviderConfig } from "./types";

export function createOpenRouterProvider(config: ProviderConfig): LLMProvider {
  const model = config.model ?? "meta-llama/llama-3.3-70b-instruct:free";

  return {
    name: "openrouter",
    async sendMessage(messages, tools, signal) {
      const msgs = messages.map((m) => ({ role: m.role, content: m.content }));

      const body: Record<string, unknown> = { model, messages: msgs };

      const supportsTools = !model.includes(":free");
      if (tools.length > 0 && supportsTools) {
        body.tools = toolsToOpenAIFormat(tools);
        body.tool_choice = "auto";
      } else if (tools.length > 0) {
        const toolDesc = tools.map((t) =>
          `${t.name}(${JSON.stringify(t.parameters)}): ${t.description}`
        ).join("\n");
        const fallbackInstruction = `\n\nHerramientas disponibles:\n${toolDesc}\n\nSi necesitas usar una herramienta, responde SOLO con un JSON:\n{"tool":"nombre","params":{...}}\nSi no necesitas herramienta, responde normalmente en texto.`;
        if (msgs.length > 0 && msgs[0].role === "system") {
          msgs[0].content += fallbackInstruction;
        }
      }

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": window.location.origin,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      const content: string = choice?.content ?? "";

      const nativeToolCalls: ToolCall[] = (choice?.tool_calls ?? []).map(
        (tc: { function: { name: string; arguments: string } }) => ({
          name: tc.function.name,
          params: JSON.parse(tc.function.arguments),
        })
      );

      if (nativeToolCalls.length > 0) {
        return { message: content, toolCalls: nativeToolCalls };
      }

      const trimmed = content.trim();
      if (trimmed.startsWith("{") && trimmed.includes('"tool"')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.tool && typeof parsed.tool === "string") {
            return {
              message: "",
              toolCalls: [{ name: parsed.tool, params: parsed.params ?? {} }],
            };
          }
        } catch {
          // Not valid JSON — treat as regular text
        }
      }

      return { message: content, toolCalls: [] } satisfies ProviderResponse;
    },
  };
}
