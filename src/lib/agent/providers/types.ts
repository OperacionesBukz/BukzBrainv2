import type { ToolDefinition } from "../types";

export interface ProviderConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export function toolsToGeminiFormat(tools: ToolDefinition[]) {
  return [{
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  }];
}

export function toolsToOpenAIFormat(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
