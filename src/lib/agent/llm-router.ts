import type { LLMProvider, ProviderResponse, ToolDefinition } from "./types";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createOpenRouterProvider } from "./providers/openrouter";

const TIMEOUT_MS = 10_000;

function buildProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  const openrouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (geminiKey) providers.push(createGeminiProvider({ apiKey: geminiKey }));
  if (groqKey) providers.push(createGroqProvider({ apiKey: groqKey }));
  if (openrouterKey) providers.push(createOpenRouterProvider({ apiKey: openrouterKey }));

  return providers;
}

let cachedProviders: LLMProvider[] | null = null;

function getProviders(): LLMProvider[] {
  if (!cachedProviders) cachedProviders = buildProviders();
  return cachedProviders;
}

export async function sendToLLM(
  messages: { role: string; content: string }[],
  tools: ToolDefinition[]
): Promise<ProviderResponse & { provider: string }> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error("No hay API keys configuradas para los proveedores LLM");
  }

  for (const provider of providers) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await provider.sendMessage(messages, tools, controller.signal);
      clearTimeout(timeout);

      return { ...response, provider: provider.name };
    } catch (err) {
      console.warn(`[agent] ${provider.name} failed:`, err);
      continue;
    }
  }

  throw new Error("Todos los modelos están ocupados. Intenta en unos minutos.");
}
