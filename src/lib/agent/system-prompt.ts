// src/lib/agent/system-prompt.ts
import type { ToolDefinition, ModuleContext } from "./types";

interface PromptContext {
  userName: string;
  userEmail: string;
  userRole: string;
  currentModule: ModuleContext;
  tools: ToolDefinition[];
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const toolDescriptions = ctx.tools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  return `Eres BukzBrain Assistant, el asistente interno de Bukz.
Responde siempre en español.
Sé conciso y directo en tus respuestas.

Usuario actual: ${ctx.userName} (${ctx.userEmail}), rol: ${ctx.userRole}
Página actual: ${ctx.currentModule}

Tienes acceso a las siguientes herramientas:
${toolDescriptions}

Cuando necesites ejecutar una acción, usa las herramientas disponibles.
Si no puedes hacer algo, explícalo claramente.
No inventes datos. Si no tienes la información, dilo.`;
}
