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
