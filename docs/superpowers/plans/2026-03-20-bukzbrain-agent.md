# BukzBrain Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI assistant integrated into BukzBrainv2 that answers questions and executes Firestore actions via natural language, using free LLM APIs (Gemini/Groq/OpenRouter) with automatic fallback.

**Architecture:** Client-direct approach — React frontend calls LLM APIs via fetch, tools execute Firestore operations from the client. LLM Router handles provider fallback. Chat UI is a floating bubble + full `/assistant` page. Conversation history persisted in Firestore.

**Tech Stack:** React 18, TypeScript, Firebase/Firestore, shadcn/ui, Tailwind CSS, native fetch (no new dependencies)

**Note:** Streaming (token-by-token responses) is deferred to a future iteration. V1 uses request/response for simplicity and faster delivery. All three providers support streaming and it can be added without architectural changes.

**Spec:** `docs/superpowers/specs/2026-03-20-bukzbrain-agent-design.md`

---

## File Structure

```
src/lib/agent/
  types.ts                 - All types (Message, Conversation, ToolCall, ToolDef, ProviderResponse)
  tool-registry.ts         - Tool definitions registry with JSON schemas
  tools/
    tasks.ts               - Tools for user_tasks and tasks collections
    requests.ts            - Tools for leave_requests collection
    celesa.ts              - Tools for celesa_orders collection
    products.ts            - Tools for products collection
    bookstore.ts           - Tools for bookstore_requests collection
    dashboard.ts           - Dashboard summary tool
  providers/
    types.ts               - Provider interface and shared types
    gemini.ts              - Gemini Flash adapter
    groq.ts                - Groq (OpenAI-compatible) adapter
    openrouter.ts          - OpenRouter adapter
  llm-router.ts            - Fallback router across providers
  system-prompt.ts         - System prompt builder
  use-agent-chat.ts        - AgentChatProvider + useAgentChat hook (shared state via Context)
  rate-limiter.ts          - Sliding window rate limiter

src/components/agent/
  ChatBubble.tsx           - Floating button (bottom-right)
  ChatPanel.tsx            - Chat panel (messages, input, tool chips)
  ChatMessage.tsx          - Single message bubble (user or assistant)
  ToolChip.tsx             - Tool execution status chip

src/pages/
  Assistant.tsx            - Full-page assistant with conversation sidebar

src/contexts/
  AgentContext.tsx          - Page context provider (current module name)
```

---

## Task 1: Types and Core Definitions

**Files:**
- Create: `src/lib/agent/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/agent/types.ts
import { Timestamp } from "firebase/firestore";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallResult[];
  timestamp: Timestamp | null;
}

export interface AgentConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ToolCall {
  name: string;
  params: Record<string, unknown>;
}

export interface ToolCallResult extends ToolCall {
  result: { success: boolean; data?: unknown; error?: string };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute: (params: Record<string, unknown>, userId: string) => Promise<ToolCallResult["result"]>;
}

export interface ProviderResponse {
  message: string;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  name: string;
  sendMessage: (
    messages: { role: string; content: string }[],
    tools: ToolDefinition[],
    signal?: AbortSignal
  ) => Promise<ProviderResponse>;
}

export type ModuleContext =
  | "Dashboard" | "Tareas Personales" | "Operaciones" | "Celesa"
  | "Solicitudes" | "Solicitudes Librerias" | "Hub de Solicitudes"
  | "Reposicion" | "Ingreso Mercancia" | "Scrap Bukz" | "Calculadora"
  | "Instrucciones" | "Admin Navegacion" | "Admin Usuarios" | "Asistente"
  | "Desconocido";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/types.ts
git commit -m "feat(agent): add core type definitions"
```

---

## Task 2: Rate Limiter

**Files:**
- Create: `src/lib/agent/rate-limiter.ts`
- Create: `src/test/agent/rate-limiter.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/test/agent/rate-limiter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter } from "@/lib/agent/rate-limiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows messages under the limit", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.canSend()).toBe(true);
    limiter.record();
    limiter.record();
    limiter.record();
    expect(limiter.canSend()).toBe(false);
  });

  it("allows messages after window expires", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.record();
    expect(limiter.canSend()).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(limiter.canSend()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/agent/rate-limiter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement rate limiter**

```typescript
// src/lib/agent/rate-limiter.ts
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxMessages: number = 20,
    private windowMs: number = 60_000
  ) {}

  canSend(): boolean {
    this.prune();
    return this.timestamps.length < this.maxMessages;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/agent/rate-limiter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/rate-limiter.ts src/test/agent/rate-limiter.test.ts
git commit -m "feat(agent): add sliding window rate limiter"
```

---

## Task 3: System Prompt Builder

**Files:**
- Create: `src/lib/agent/system-prompt.ts`

- [ ] **Step 1: Create the system prompt builder**

```typescript
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
Responde siempre en espanol.
Se conciso y directo en tus respuestas.

Usuario actual: ${ctx.userName} (${ctx.userEmail}), rol: ${ctx.userRole}
Pagina actual: ${ctx.currentModule}

Tienes acceso a las siguientes herramientas:
${toolDescriptions}

Cuando necesites ejecutar una accion, usa las herramientas disponibles.
Si no puedes hacer algo, explicalo claramente.
No inventes datos. Si no tienes la informacion, dilo.`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/system-prompt.ts
git commit -m "feat(agent): add system prompt builder"
```

---

## Task 4: LLM Providers — Gemini Adapter

**Files:**
- Create: `src/lib/agent/providers/types.ts`
- Create: `src/lib/agent/providers/gemini.ts`

- [ ] **Step 1: Create provider shared types**

```typescript
// src/lib/agent/providers/types.ts
import type { ToolDefinition } from "../types";

export interface ProviderConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

/** Convert our ToolDefinition[] to the format each provider expects */
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
```

- [ ] **Step 2: Create Gemini adapter**

```typescript
// src/lib/agent/providers/gemini.ts
import type { LLMProvider, ProviderResponse, ToolDefinition, ToolCall } from "../types";
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
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/providers/
git commit -m "feat(agent): add Gemini provider adapter"
```

---

## Task 5: LLM Providers — Groq and OpenRouter Adapters

**Files:**
- Create: `src/lib/agent/providers/groq.ts`
- Create: `src/lib/agent/providers/openrouter.ts`

- [ ] **Step 1: Create Groq adapter (OpenAI-compatible)**

```typescript
// src/lib/agent/providers/groq.ts
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

      if (!res.ok) throw new Error(`Groq error: ${res.status} ${res.statusText}`);

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
```

- [ ] **Step 2: Create OpenRouter adapter**

```typescript
// src/lib/agent/providers/openrouter.ts
import type { LLMProvider, ProviderResponse, ToolCall } from "../types";
import { toolsToOpenAIFormat, type ProviderConfig } from "./types";

export function createOpenRouterProvider(config: ProviderConfig): LLMProvider {
  const model = config.model ?? "meta-llama/llama-3.3-70b-instruct:free";

  return {
    name: "openrouter",
    async sendMessage(messages, tools, signal) {
      // OpenRouter free models may not support function calling.
      // If tools are needed, inject them into the system prompt as JSON instructions.
      const msgs = messages.map((m) => ({ role: m.role, content: m.content }));

      const body: Record<string, unknown> = { model, messages: msgs };

      // Try native tool calling first
      const supportsTools = !model.includes(":free");
      if (tools.length > 0 && supportsTools) {
        body.tools = toolsToOpenAIFormat(tools);
        body.tool_choice = "auto";
      } else if (tools.length > 0) {
        // Prompt-based fallback for free models
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

      // Check for native tool calls
      const nativeToolCalls: ToolCall[] = (choice?.tool_calls ?? []).map(
        (tc: { function: { name: string; arguments: string } }) => ({
          name: tc.function.name,
          params: JSON.parse(tc.function.arguments),
        })
      );

      if (nativeToolCalls.length > 0) {
        return { message: content, toolCalls: nativeToolCalls };
      }

      // Check for prompt-based tool call in content
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
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/providers/groq.ts src/lib/agent/providers/openrouter.ts
git commit -m "feat(agent): add Groq and OpenRouter provider adapters"
```

---

## Task 6: LLM Router

**Files:**
- Create: `src/lib/agent/llm-router.ts`

- [ ] **Step 1: Create the router with fallback logic**

```typescript
// src/lib/agent/llm-router.ts
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

  throw new Error("Todos los modelos estan ocupados. Intenta en unos minutos.");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/llm-router.ts
git commit -m "feat(agent): add LLM router with automatic fallback"
```

---

## Task 7: Tool Registry and Task Tools

**Files:**
- Create: `src/lib/agent/tool-registry.ts`
- Create: `src/lib/agent/tools/tasks.ts`

- [ ] **Step 1: Create the tool registry**

```typescript
// src/lib/agent/tool-registry.ts
import type { ToolDefinition } from "./types";
import { taskTools } from "./tools/tasks";
// Future imports:
// import { requestTools } from "./tools/requests";
// import { celesaTools } from "./tools/celesa";
// import { productTools } from "./tools/products";
// import { bookstoreTools } from "./tools/bookstore";
// import { dashboardTools } from "./tools/dashboard";

export function getAllTools(): ToolDefinition[] {
  return [
    ...taskTools,
    // ...requestTools,
    // ...celesaTools,
    // ...productTools,
    // ...bookstoreTools,
    // ...dashboardTools,
  ];
}
```

- [ ] **Step 2: Create task tools (user_tasks collection)**

```typescript
// src/lib/agent/tools/tasks.ts
import {
  collection, addDoc, query, where, getDocs, getDoc, updateDoc, doc, serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const taskTools: ToolDefinition[] = [
  {
    name: "createPersonalTask",
    description: "Crea una tarea personal para el usuario. Parametros: title (obligatorio), priority (Baja/Media/Alta/Urgente, default Media), dueDate (YYYY-MM-DD, opcional)",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo de la tarea" },
        priority: { type: "string", enum: ["Baja", "Media", "Alta", "Urgente"], description: "Prioridad" },
        dueDate: { type: "string", description: "Fecha limite en formato YYYY-MM-DD" },
      },
      required: ["title"],
    },
    async execute(params, userId) {
      try {
        const data: Record<string, unknown> = {
          title: params.title,
          priority: params.priority ?? "Media",
          status: "todo",
          notes: "",
          subtasks: [],
          userId,
          createdAt: serverTimestamp(),
          order: Date.now(),
        };
        if (params.dueDate) data.dueDate = params.dueDate;

        const ref = await addDoc(collection(db, "user_tasks"), data);
        return { success: true, data: { id: ref.id, title: params.title } };
      } catch (err) {
        return { success: false, error: `Error al crear tarea: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "listPersonalTasks",
    description: "Lista las tareas personales del usuario. Parametros: status (todo/done, opcional, default todo)",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["todo", "done"], description: "Filtrar por estado" },
      },
    },
    async execute(params, userId) {
      try {
        const constraints = [where("userId", "==", userId)];
        if (params.status) constraints.push(where("status", "==", params.status));

        const q = query(collection(db, "user_tasks"), ...constraints);
        const snap = await getDocs(q);
        const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { success: true, data: { count: tasks.length, tasks } };
      } catch (err) {
        return { success: false, error: `Error al listar tareas: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "updatePersonalTask",
    description: "Actualiza una tarea personal. Parametros: taskId (obligatorio), title (opcional), priority (opcional), status (todo/done, opcional)",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID de la tarea" },
        title: { type: "string", description: "Nuevo titulo" },
        priority: { type: "string", enum: ["Baja", "Media", "Alta", "Urgente"] },
        status: { type: "string", enum: ["todo", "done"] },
      },
      required: ["taskId"],
    },
    async execute(params, userId) {
      try {
        // Verify ownership before updating
        const taskDoc = await getDoc(doc(db, "user_tasks", params.taskId as string));
        if (!taskDoc.exists() || taskDoc.data().userId !== userId) {
          return { success: false, error: "Tarea no encontrada o no tienes permiso" };
        }

        const updates: Record<string, unknown> = {};
        if (params.title) updates.title = params.title;
        if (params.priority) updates.priority = params.priority;
        if (params.status) updates.status = params.status;

        if (Object.keys(updates).length === 0) {
          return { success: false, error: "No se proporcionaron campos para actualizar" };
        }

        await updateDoc(doc(db, "user_tasks", params.taskId as string), updates);
        return { success: true, data: { taskId: params.taskId, updated: Object.keys(updates) } };
      } catch (err) {
        return { success: false, error: `Error al actualizar tarea: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "assignTask",
    description: "Asigna una tarea a otro usuario. Parametros: title (obligatorio), assignedTo (email del usuario destino), priority (opcional), dueDate (opcional)",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo de la tarea" },
        assignedTo: { type: "string", description: "Email del usuario destino" },
        priority: { type: "string", enum: ["Baja", "Media", "Alta", "Urgente"] },
        dueDate: { type: "string", description: "Fecha limite YYYY-MM-DD" },
      },
      required: ["title", "assignedTo"],
    },
    async execute(params, userId) {
      try {
        const data: Record<string, unknown> = {
          title: params.title,
          priority: params.priority ?? "Media",
          status: "todo",
          notes: "",
          subtasks: [],
          userId: params.assignedTo, // The assignee owns the task
          assignedTo: params.assignedTo,
          assignedBy: userId,
          createdAt: serverTimestamp(),
          order: Date.now(),
        };
        if (params.dueDate) data.dueDate = params.dueDate;

        const ref = await addDoc(collection(db, "user_tasks"), data);
        return { success: true, data: { id: ref.id, assignedTo: params.assignedTo } };
      } catch (err) {
        return { success: false, error: `Error al asignar tarea: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "createOperationsTask",
    description: "Crea una tarea en el kanban de operaciones. Parametros: title (obligatorio), department (General/Devolucion/SAC/Operaciones, default General)",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo de la tarea" },
        department: { type: "string", enum: ["General", "Devolución", "SAC", "Operaciones"] },
      },
      required: ["title"],
    },
    async execute(params, userId) {
      try {
        const ref = await addDoc(collection(db, "tasks"), {
          title: params.title,
          department: params.department ?? "General",
          status: "todo",
          notes: "",
          subtasks: [],
          createdBy: userId,
          createdAt: serverTimestamp(),
          order: Date.now(),
        });
        return { success: true, data: { id: ref.id, title: params.title } };
      } catch (err) {
        return { success: false, error: `Error al crear tarea de operaciones: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "listOperationsTasks",
    description: "Lista tareas del kanban de operaciones. Parametros: department (opcional), status (todo/done, opcional)",
    parameters: {
      type: "object",
      properties: {
        department: { type: "string", enum: ["General", "Devolución", "SAC", "Operaciones"] },
        status: { type: "string", enum: ["todo", "done"] },
      },
    },
    async execute(params) {
      try {
        const constraints = [];
        if (params.department) constraints.push(where("department", "==", params.department));
        if (params.status) constraints.push(where("status", "==", params.status));
        const q = query(collection(db, "tasks"), ...constraints);
        const snap = await getDocs(q);
        return { success: true, data: { count: snap.size, tasks: snap.docs.map((d) => ({ id: d.id, ...d.data() })) } };
      } catch (err) {
        return { success: false, error: `Error al listar tareas de operaciones: ${(err as Error).message}` };
      }
    },
  },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/tool-registry.ts src/lib/agent/tools/tasks.ts
git commit -m "feat(agent): add tool registry and personal task tools"
```

---

## Task 8: Remaining Tools (Requests, Celesa, Products, Bookstore, Dashboard)

**Files:**
- Create: `src/lib/agent/tools/requests.ts`
- Create: `src/lib/agent/tools/celesa.ts`
- Create: `src/lib/agent/tools/products.ts`
- Create: `src/lib/agent/tools/bookstore.ts`
- Create: `src/lib/agent/tools/dashboard.ts`
- Modify: `src/lib/agent/tool-registry.ts` — uncomment all imports

- [ ] **Step 1: Create requests tools**

```typescript
// src/lib/agent/tools/requests.ts
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const requestTools: ToolDefinition[] = [
  {
    name: "createLeaveRequest",
    description: "Crea una solicitud de permiso/vacaciones. Parametros: type (permiso/vacaciones/otro), startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), reason (motivo)",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Tipo de solicitud" },
        startDate: { type: "string", description: "Fecha inicio YYYY-MM-DD" },
        endDate: { type: "string", description: "Fecha fin YYYY-MM-DD" },
        reason: { type: "string", description: "Motivo de la solicitud" },
      },
      required: ["type", "startDate", "endDate"],
    },
    async execute(params, userId) {
      try {
        const ref = await addDoc(collection(db, "leave_requests"), {
          userId,
          type: params.type,
          startDate: params.startDate,
          endDate: params.endDate,
          reason: params.reason ?? "",
          status: "pending",
          createdAt: serverTimestamp(),
        });
        return { success: true, data: { id: ref.id } };
      } catch (err) {
        return { success: false, error: `Error al crear solicitud: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "listLeaveRequests",
    description: "Lista solicitudes de permisos/vacaciones. Parametros: status (pending/approved/rejected, opcional)",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "rejected"] },
      },
    },
    async execute(params, userId) {
      try {
        const constraints = [where("userId", "==", userId)];
        if (params.status) constraints.push(where("status", "==", params.status));
        const q = query(collection(db, "leave_requests"), ...constraints);
        const snap = await getDocs(q);
        return { success: true, data: { count: snap.size, requests: snap.docs.map((d) => ({ id: d.id, ...d.data() })) } };
      } catch (err) {
        return { success: false, error: `Error al listar solicitudes: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "updateLeaveRequestStatus",
    description: "Aprueba o rechaza una solicitud de permiso/vacaciones. Parametros: requestId (obligatorio), status (approved/rejected)",
    parameters: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "ID de la solicitud" },
        status: { type: "string", enum: ["approved", "rejected"], description: "Nuevo estado" },
      },
      required: ["requestId", "status"],
    },
    async execute(params) {
      try {
        await updateDoc(doc(db, "leave_requests", params.requestId as string), {
          status: params.status,
        });
        return { success: true, data: { requestId: params.requestId, status: params.status } };
      } catch (err) {
        return { success: false, error: `Error al actualizar solicitud: ${(err as Error).message}` };
      }
    },
  },
];
```

- [ ] **Step 2: Create celesa tools**

```typescript
// src/lib/agent/tools/celesa.ts
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const celesaTools: ToolDefinition[] = [
  {
    name: "queryCelesaOrders",
    description: "Consulta pedidos de Celesa. Parametros: status (opcional), limit (numero, default 20)",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Estado del pedido" },
        limit: { type: "number", description: "Cantidad maxima de resultados" },
      },
    },
    async execute(params) {
      try {
        const constraints = [];
        if (params.status) constraints.push(where("status", "==", params.status));
        const q = query(collection(db, "celesa_orders"), ...constraints);
        const snap = await getDocs(q);
        const orders = snap.docs.slice(0, (params.limit as number) || 20).map((d) => ({ id: d.id, ...d.data() }));
        return { success: true, data: { count: orders.length, orders } };
      } catch (err) {
        return { success: false, error: `Error al consultar pedidos: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "getCelesaStats",
    description: "Obtiene estadisticas de pedidos Celesa (totales por estado)",
    parameters: { type: "object", properties: {} },
    async execute() {
      try {
        const snap = await getDocs(collection(db, "celesa_orders"));
        const stats: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const status = (d.data().status as string) ?? "unknown";
          stats[status] = (stats[status] ?? 0) + 1;
        });
        return { success: true, data: { total: snap.size, byStatus: stats } };
      } catch (err) {
        return { success: false, error: `Error al obtener estadisticas: ${(err as Error).message}` };
      }
    },
  },
];
```

- [ ] **Step 3: Create products tools**

```typescript
// src/lib/agent/tools/products.ts
import { collection, query, where, getDocs, getDoc, doc, limit as firestoreLimit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const productTools: ToolDefinition[] = [
  {
    name: "searchProducts",
    description: "Busca productos por titulo o ISBN. Parametros: query (texto de busqueda), limit (numero, default 10)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto de busqueda (titulo o ISBN)" },
        limit: { type: "number", description: "Cantidad maxima de resultados" },
      },
      required: ["query"],
    },
    async execute(params) {
      try {
        // Firestore no soporta full-text search, buscar por ISBN exacto o prefijo de titulo
        const searchQuery = String(params.query).trim();
        let snap;
        if (/^\d{10,13}$/.test(searchQuery)) {
          const q = query(collection(db, "products"), where("isbn", "==", searchQuery));
          snap = await getDocs(q);
        } else {
          // Prefix search on title (limited but functional)
          const q = query(
            collection(db, "products"),
            where("title", ">=", searchQuery),
            where("title", "<=", searchQuery + "\uf8ff"),
            firestoreLimit((params.limit as number) || 10)
          );
          snap = await getDocs(q);
        }
        return { success: true, data: { count: snap.size, products: snap.docs.map((d) => ({ id: d.id, ...d.data() })) } };
      } catch (err) {
        return { success: false, error: `Error al buscar productos: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "getProductInventory",
    description: "Consulta el inventario de un producto por su ID. Parametros: productId (obligatorio)",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID del producto" },
      },
      required: ["productId"],
    },
    async execute(params) {
      try {
        const snap = await getDoc(doc(db, "products", params.productId as string));
        if (!snap.exists()) return { success: false, error: "Producto no encontrado" };
        const data = snap.data();
        return { success: true, data: { id: snap.id, title: data.title, stock: data.stock, isbn: data.isbn } };
      } catch (err) {
        return { success: false, error: `Error al consultar inventario: ${(err as Error).message}` };
      }
    },
  },
];
```

- [ ] **Step 4: Create bookstore tools**

```typescript
// src/lib/agent/tools/bookstore.ts
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const bookstoreTools: ToolDefinition[] = [
  {
    name: "listBookstoreRequests",
    description: "Lista solicitudes de librerias. Parametros: status (opcional)",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtrar por estado" },
      },
    },
    async execute(params) {
      try {
        const constraints = [];
        if (params.status) constraints.push(where("status", "==", params.status));
        const q = query(collection(db, "bookstore_requests"), ...constraints);
        const snap = await getDocs(q);
        return { success: true, data: { count: snap.size, requests: snap.docs.map((d) => ({ id: d.id, ...d.data() })) } };
      } catch (err) {
        return { success: false, error: `Error al listar solicitudes: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "updateBookstoreRequest",
    description: "Actualiza el estado de una solicitud de libreria. Parametros: requestId, status",
    parameters: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "ID de la solicitud" },
        status: { type: "string", description: "Nuevo estado" },
      },
      required: ["requestId", "status"],
    },
    async execute(params) {
      try {
        await updateDoc(doc(db, "bookstore_requests", params.requestId as string), {
          status: params.status,
        });
        return { success: true, data: { requestId: params.requestId, status: params.status } };
      } catch (err) {
        return { success: false, error: `Error al actualizar solicitud: ${(err as Error).message}` };
      }
    },
  },
];
```

- [ ] **Step 5: Create dashboard tools**

```typescript
// src/lib/agent/tools/dashboard.ts
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const dashboardTools: ToolDefinition[] = [
  {
    name: "getDashboardSummary",
    description: "Obtiene un resumen general: tareas pendientes, solicitudes pendientes, pedidos activos",
    parameters: { type: "object", properties: {} },
    async execute(_params, userId) {
      try {
        const [tasksSnap, requestsSnap, ordersSnap] = await Promise.all([
          getDocs(query(collection(db, "user_tasks"), where("userId", "==", userId), where("status", "==", "todo"))),
          getDocs(query(collection(db, "leave_requests"), where("status", "==", "pending"))),
          getDocs(collection(db, "celesa_orders")),
        ]);
        return {
          success: true,
          data: {
            pendingTasks: tasksSnap.size,
            pendingRequests: requestsSnap.size,
            totalOrders: ordersSnap.size,
          },
        };
      } catch (err) {
        return { success: false, error: `Error al obtener resumen: ${(err as Error).message}` };
      }
    },
  },
];
```

- [ ] **Step 6: Update tool-registry to import all tools**

```typescript
// src/lib/agent/tool-registry.ts — REPLACE FULL FILE
import type { ToolDefinition } from "./types";
import { taskTools } from "./tools/tasks";
import { requestTools } from "./tools/requests";
import { celesaTools } from "./tools/celesa";
import { productTools } from "./tools/products";
import { bookstoreTools } from "./tools/bookstore";
import { dashboardTools } from "./tools/dashboard";

export function getAllTools(): ToolDefinition[] {
  return [
    ...taskTools,
    ...requestTools,
    ...celesaTools,
    ...productTools,
    ...bookstoreTools,
    ...dashboardTools,
  ];
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent/tools/ src/lib/agent/tool-registry.ts
git commit -m "feat(agent): add all Firestore tools (requests, celesa, products, bookstore, dashboard)"
```

---

## Task 9: Agent Context (Page Context Provider)

**Files:**
- Create: `src/contexts/AgentContext.tsx`

- [ ] **Step 1: Create the context**

```typescript
// src/contexts/AgentContext.tsx
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { ModuleContext } from "@/lib/agent/types";

const routeToModule: Record<string, ModuleContext> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tareas Personales",
  "/operations": "Operaciones",
  "/celesa": "Celesa",
  "/requests": "Solicitudes",
  "/bookstore-requests": "Solicitudes Librerias",
  "/requests-hub": "Hub de Solicitudes",
  "/reposicion": "Reposicion",
  "/ingreso": "Ingreso Mercancia",
  "/scrap": "Scrap Bukz",
  "/calculator": "Calculadora",
  "/instructions": "Instrucciones",
  "/nav-admin": "Admin Navegacion",
  "/user-admin": "Admin Usuarios",
  "/assistant": "Asistente",
};

interface AgentContextValue {
  currentModule: ModuleContext;
}

const AgentCtx = createContext<AgentContextValue>({ currentModule: "Desconocido" });

export function AgentProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const currentModule = useMemo<ModuleContext>(() => {
    return routeToModule[pathname] ?? "Desconocido";
  }, [pathname]);

  return (
    <AgentCtx.Provider value={{ currentModule }}>
      {children}
    </AgentCtx.Provider>
  );
}

export const useAgentContext = () => useContext(AgentCtx);
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/AgentContext.tsx
git commit -m "feat(agent): add AgentContext for page-aware module detection"
```

---

## Task 10: AgentChat Provider (Shared Chat State)

**Files:**
- Create: `src/lib/agent/use-agent-chat.ts`

This is the core module that manages: conversation state, Firestore persistence, sending messages, tool execution loop, and rate limiting. It exposes a **Context provider** so that both the floating ChatBubble and the full-page Assistant share the same state (critical for the "open in full page" button to work).

- [ ] **Step 1: Create the hook and provider**

```typescript
// src/lib/agent/use-agent-chat.ts
import { useState, useCallback, useEffect, useRef, createContext, useContext, type ReactNode } from "react";
import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy, where, serverTimestamp, limit as firestoreLimit
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentContext } from "@/contexts/AgentContext";
import { sendToLLM } from "./llm-router";
import { getAllTools } from "./tool-registry";
import { buildSystemPrompt } from "./system-prompt";
import { RateLimiter } from "./rate-limiter";
import type { AgentMessage, AgentConversation, ToolCallResult } from "./types";

const rateLimiter = new RateLimiter(20, 60_000);
const MAX_CONTEXT_MESSAGES = 30;

interface AgentChatState {
  messages: AgentMessage[];
  conversations: AgentConversation[];
  conversationId: string | null;
  loading: boolean;
  error: string | null;
  rateLimited: boolean;
  sendMessage: (content: string) => Promise<void>;
  startNewConversation: () => Promise<string | undefined>;
  selectConversation: (id: string) => void;
  cancelRequest: () => void;
}

const AgentChatCtx = createContext<AgentChatState | null>(null);

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const { currentModule } = useAgentContext();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load conversations list — filtered at Firestore level for privacy
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "agent_conversations"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc"),
      firestoreLimit(50)
    );
    return onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgentConversation)));
    });
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    const q = query(
      collection(db, "agent_conversations", conversationId, "messages"),
      orderBy("timestamp", "asc")
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgentMessage)));
    });
  }, [conversationId]);

  const startNewConversation = useCallback(async () => {
    if (!user) return;
    const ref = await addDoc(collection(db, "agent_conversations"), {
      userId: user.uid,
      title: "Nueva conversacion",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    setMessages([]);
    return ref.id;
  }, [user]);

  const selectConversation = useCallback((id: string) => {
    setConversationId(id);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !content.trim()) return;
    if (!rateLimiter.canSend()) {
      setRateLimited(true);
      setTimeout(() => setRateLimited(false), 5_000);
      return;
    }

    setError(null);
    setLoading(true);
    rateLimiter.record();

    // Create AbortController for this request
    const controller = new AbortController();
    abortRef.current = controller;

    let activeConvId = conversationId;
    if (!activeConvId) {
      activeConvId = (await startNewConversation()) ?? null;
      if (!activeConvId) { setLoading(false); return; }
    }

    // Save user message
    await addDoc(collection(db, "agent_conversations", activeConvId, "messages"), {
      role: "user",
      content,
      timestamp: serverTimestamp(),
    });

    // Update conversation title if first message
    if (messages.length === 0) {
      await updateDoc(doc(db, "agent_conversations", activeConvId), {
        title: content.slice(0, 50),
        updatedAt: serverTimestamp(),
      });
    }

    // Build LLM messages
    const tools = getAllTools();
    const systemPrompt = buildSystemPrompt({
      userName: user.displayName ?? user.email?.split("@")[0] ?? "Usuario",
      userEmail: user.email ?? "",
      userRole: role ?? "user",
      currentModule,
      tools,
    });

    const llmMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add recent messages as context
    const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
    for (const msg of recentMessages) {
      llmMessages.push({ role: msg.role, content: msg.content });
    }
    llmMessages.push({ role: "user", content });

    try {
      // Tool execution loop (max 5 iterations to prevent infinite loops)
      let iteration = 0;
      let response = await sendToLLM(llmMessages, tools);

      while (response.toolCalls.length > 0 && iteration < 5) {
        if (controller.signal.aborted) break;
        iteration++;
        const results: ToolCallResult[] = [];

        for (const tc of response.toolCalls) {
          const tool = tools.find((t) => t.name === tc.name);
          if (!tool) {
            results.push({ ...tc, result: { success: false, error: `Tool ${tc.name} no encontrada` } });
            continue;
          }
          const result = await tool.execute(tc.params, user.uid);
          results.push({ ...tc, result });
        }

        // Send tool results back to LLM
        llmMessages.push({
          role: "assistant",
          content: response.message || `Ejecutando: ${response.toolCalls.map((t) => t.name).join(", ")}`,
        });
        llmMessages.push({
          role: "user",
          content: `Resultados de herramientas:\n${JSON.stringify(results.map((r) => ({ tool: r.name, result: r.result })), null, 2)}`,
        });

        response = await sendToLLM(llmMessages, tools);

        // Save final response with tool call info
        if (response.toolCalls.length === 0) {
          await addDoc(collection(db, "agent_conversations", activeConvId, "messages"), {
            role: "assistant",
            content: response.message,
            toolCalls: results,
            timestamp: serverTimestamp(),
          });
        }
      }

      // If no tool calls, save response directly
      if (iteration === 0) {
        await addDoc(collection(db, "agent_conversations", activeConvId, "messages"), {
          role: "assistant",
          content: response.message,
          timestamp: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, "agent_conversations", activeConvId), {
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [user, role, conversationId, messages, currentModule, startNewConversation]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  return (
    <AgentChatCtx.Provider value={{
      messages, conversations, conversationId, loading, error, rateLimited,
      sendMessage, startNewConversation, selectConversation, cancelRequest,
    }}>
      {children}
    </AgentChatCtx.Provider>
  );
}

export function useAgentChat(): AgentChatState {
  const ctx = useContext(AgentChatCtx);
  if (!ctx) throw new Error("useAgentChat must be used within AgentChatProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/use-agent-chat.ts
git commit -m "feat(agent): add useAgentChat hook with tool execution loop"
```

---

## Task 11: Chat UI Components

**Files:**
- Create: `src/components/agent/ToolChip.tsx`
- Create: `src/components/agent/ChatMessage.tsx`
- Create: `src/components/agent/ChatPanel.tsx`
- Create: `src/components/agent/ChatBubble.tsx`

- [ ] **Step 1: Create ToolChip**

```tsx
// src/components/agent/ToolChip.tsx
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallResult } from "@/lib/agent/types";

interface ToolChipProps {
  toolCall: ToolCallResult;
}

const toolLabels: Record<string, string> = {
  createPersonalTask: "Crear tarea",
  listPersonalTasks: "Listar tareas",
  updatePersonalTask: "Actualizar tarea",
  assignTask: "Asignar tarea",
  createOperationsTask: "Crear tarea operaciones",
  listOperationsTasks: "Listar tareas operaciones",
  createLeaveRequest: "Crear solicitud",
  listLeaveRequests: "Listar solicitudes",
  updateLeaveRequestStatus: "Actualizar solicitud",
  queryCelesaOrders: "Consultar pedidos",
  getCelesaStats: "Estadisticas Celesa",
  searchProducts: "Buscar productos",
  getProductInventory: "Consultar inventario",
  listBookstoreRequests: "Solicitudes librerias",
  updateBookstoreRequest: "Actualizar solicitud libreria",
  getDashboardSummary: "Resumen general",
};

export function ToolChip({ toolCall }: ToolChipProps) {
  const label = toolLabels[toolCall.name] ?? toolCall.name;
  const success = toolCall.result.success;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        success
          ? "bg-green-500/15 text-green-600 dark:text-green-400"
          : "bg-destructive/15 text-destructive"
      )}
    >
      {success ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function ToolChipLoading({ name }: { name: string }) {
  const label = toolLabels[name] ?? name;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      {label}...
    </span>
  );
}
```

- [ ] **Step 2: Create ChatMessage**

```tsx
// src/components/agent/ChatMessage.tsx
import { cn } from "@/lib/utils";
import { ToolChip } from "./ToolChip";
import type { AgentMessage } from "@/lib/agent/types";

interface ChatMessageProps {
  message: AgentMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {message.toolCalls.map((tc, i) => (
              <ToolChip key={i} toolCall={tc} />
            ))}
          </div>
        )}
        {message.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ChatPanel**

```tsx
// src/components/agent/ChatPanel.tsx
import { useState, useRef, useEffect } from "react";
import { Send, Square, Bot, Maximize2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { useAgentChat } from "@/lib/agent/use-agent-chat";
import { useNavigate } from "react-router-dom";

interface ChatPanelProps {
  onClose: () => void;
  className?: string;
}

export function ChatPanel({ onClose, className }: ChatPanelProps) {
  const {
    messages, loading, error, rateLimited,
    sendMessage, startNewConversation, cancelRequest,
  } = useAgentChat();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn(
      "flex flex-col bg-background border border-border rounded-xl shadow-xl overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1">BukzBrain Assistant</span>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => { onClose(); navigate("/assistant"); }}
          title="Abrir en pagina completa"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={onClose}
          title="Cerrar"
        >
          <span className="text-lg leading-none">&times;</span>
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 py-8">
            <Bot className="h-8 w-8 text-primary/50" />
            <p>Hola! En que puedo ayudarte?</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 text-xs text-destructive flex items-center gap-1 bg-destructive/5">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-2 border-t border-border">
        {rateLimited && (
          <p className="text-xs text-amber-500 mb-1 px-1">Espera unos segundos antes de enviar otro mensaje</p>
        )}
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            disabled={rateLimited}
            className="text-sm h-9"
          />
          {loading ? (
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={cancelRequest}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="default" size="icon" className="h-9 w-9 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || rateLimited}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ChatBubble (floating button)**

```tsx
// src/components/agent/ChatBubble.tsx
import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatPanel } from "./ChatPanel";

export function ChatBubble() {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      {/* Mobile: bottom Sheet drawer */}
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl">
            <ChatPanel onClose={() => setOpen(false)} className="h-full rounded-none border-0 shadow-none" />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop: floating panel */}
      {!isMobile && open && (
        <div className="fixed z-50 bottom-6 right-6 w-[400px] h-[560px]">
          <ChatPanel onClose={() => setOpen(false)} className="h-full" />
        </div>
      )}

      {/* Floating button — bottom-36 on mobile to avoid collision with other FABs at bottom-20 */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className={cn(
            "fixed z-50 h-12 w-12 rounded-full shadow-lg",
            "bottom-36 right-4 md:bottom-6 md:right-6",
            "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
          title="BukzBrain Assistant"
        >
          <Bot className="h-5 w-5" />
        </Button>
      )}
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/agent/
git commit -m "feat(agent): add Chat UI components (bubble, panel, messages, tool chips)"
```

---

## Task 12: Integrate ChatBubble into Layout

**Files:**
- Modify: `src/components/Layout.tsx:604` — Add ChatBubble before closing `</div>`
- Modify: `src/App.tsx` — Add AgentProvider, add `/assistant` route

- [ ] **Step 1: Add ChatBubble to Layout**

In `src/components/Layout.tsx`, add import at top:
```typescript
import { ChatBubble } from "@/components/agent/ChatBubble";
```

Before the closing `</div>` at line 604, add:
```tsx
      <ChatBubble />
    </div>
```

- [ ] **Step 2: Add AgentProvider and AgentChatProvider to App.tsx**

Add imports:
```typescript
import { AgentProvider } from "@/contexts/AgentContext";
import { AgentChatProvider } from "@/lib/agent/use-agent-chat";
```

Add lazy load:
```typescript
const Assistant = lazy(() => import("./pages/Assistant"));
```

Inside `<BrowserRouter>`, wrap `<ErrorBoundary>` with both providers (AgentProvider uses useLocation so must be inside BrowserRouter):
```tsx
<BrowserRouter basename="/BukzBrainv2">
  <AgentProvider>
    <AgentChatProvider>
      <ErrorBoundary>
        ...
      </ErrorBoundary>
    </AgentChatProvider>
  </AgentProvider>
</BrowserRouter>
```

Add route inside the authenticated Routes (after `/scrap` route):
```tsx
<Route path="/assistant" element={<Assistant />} />
```

**Note:** Add `/assistant` to `navigation_permissions` in Firestore for admin users.

- [ ] **Step 3: Verify the app compiles**

Run: `npm run build`
Expected: Build succeeds (may have TypeScript warnings but no errors)

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout.tsx src/App.tsx
git commit -m "feat(agent): integrate ChatBubble into Layout and add /assistant route"
```

---

## Task 13: Full-Page Assistant

**Files:**
- Create: `src/pages/Assistant.tsx`

- [ ] **Step 1: Create the Assistant page**

```tsx
// src/pages/Assistant.tsx
import { useState } from "react";
import { Plus, MessageSquare, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ChatPanel } from "@/components/agent/ChatPanel";
import { useAgentChat } from "@/lib/agent/use-agent-chat";

const Assistant = () => {
  const { isAdmin } = useAuth();
  const { conversations, conversationId, selectConversation, startNewConversation } = useAgentChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        No tienes acceso a esta pagina.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {/* Sidebar — historial */}
      {sidebarOpen && (
        <div className="w-64 shrink-0 border border-border rounded-xl bg-muted/20 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Conversaciones</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startNewConversation()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors",
                    conv.id === conversationId
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-3 w-3 inline mr-2" />
                  {conv.title}
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  Sin conversaciones aun
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          onClose={() => setSidebarOpen(!sidebarOpen)}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default Assistant;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Assistant.tsx
git commit -m "feat(agent): add full-page Assistant with conversation sidebar"
```

---

## Task 14: Environment Variables and Final Integration Test

**Files:**
- Modify: `.env.example` (or create if not exists) — document required keys

- [ ] **Step 1: Add API keys to .env**

Ask user for their API keys, then add to `.env`:
```
VITE_GEMINI_API_KEY=...
VITE_GROQ_API_KEY=...
VITE_OPENROUTER_API_KEY=...
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run dev server and test manually**

Run: `npm run dev`

Manual test checklist:
1. Login as admin
2. Verify floating chat bubble appears in bottom-right
3. Click bubble — chat panel opens
4. Send "Hola" — verify LLM responds in Spanish
5. Send "Crea una tarea llamada Revisar inventario con prioridad Alta" — verify task is created
6. Navigate to Tasks page — verify the task appears
7. Send "Cuantas tareas pendientes tengo?" — verify LLM uses listPersonalTasks tool
8. Go to `/assistant` — verify full page works with sidebar
9. Verify dark mode works correctly
10. Verify mobile responsive layout

- [ ] **Step 4: Commit final integration**

```bash
git add .
git commit -m "feat(agent): complete BukzBrain Agent integration"
```

---

## Summary

| Task | Description | Files |
|------|------------|-------|
| 1 | Core types | `types.ts` |
| 2 | Rate limiter + test | `rate-limiter.ts`, test |
| 3 | System prompt builder | `system-prompt.ts` |
| 4 | Gemini provider | `providers/gemini.ts`, `providers/types.ts` |
| 5 | Groq + OpenRouter providers | `providers/groq.ts`, `providers/openrouter.ts` |
| 6 | LLM Router | `llm-router.ts` |
| 7 | Tool registry + task tools | `tool-registry.ts`, `tools/tasks.ts` |
| 8 | All remaining tools | `tools/requests.ts`, `celesa.ts`, `products.ts`, `bookstore.ts`, `dashboard.ts` |
| 9 | AgentContext | `AgentContext.tsx` |
| 10 | useAgentChat hook | `use-agent-chat.ts` |
| 11 | Chat UI components | `ChatBubble.tsx`, `ChatPanel.tsx`, `ChatMessage.tsx`, `ToolChip.tsx` |
| 12 | Layout + App integration | `Layout.tsx`, `App.tsx` |
| 13 | Full-page Assistant | `Assistant.tsx` |
| 14 | Env vars + manual test | `.env`, manual testing |
