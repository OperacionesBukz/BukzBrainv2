import type { ToolDefinition, ModuleContext } from "./types";
import { taskTools } from "./tools/tasks";
import { requestTools } from "./tools/requests";
import { celesaTools } from "./tools/celesa";
import { productTools } from "./tools/products";
import { bookstoreTools } from "./tools/bookstore";
import { dashboardTools } from "./tools/dashboard";

const allTools: ToolDefinition[] = [
  ...taskTools,
  ...requestTools,
  ...celesaTools,
  ...productTools,
  ...bookstoreTools,
  ...dashboardTools,
];

// Core tools always available (lightweight)
const coreTool = dashboardTools;

// Map modules to their relevant tools to reduce token usage
const moduleTools: Partial<Record<ModuleContext, ToolDefinition[]>> = {
  "Dashboard": [...dashboardTools, ...taskTools.slice(0, 2)],
  "Tareas Personales": taskTools,
  "Operaciones": [...taskTools.filter(t => t.name.includes("Operations")), ...celesaTools],
  "Celesa": celesaTools,
  "Solicitudes": requestTools,
  "Solicitudes Librerias": bookstoreTools,
  "Hub de Solicitudes": [...requestTools, ...bookstoreTools],
  "Reposicion": productTools,
  "Ingreso Mercancia": productTools,
  "Scrap Bukz": productTools,
  "Asistente": allTools,
};

export function getAllTools(): ToolDefinition[] {
  return allTools;
}

export function getToolsForModule(module: ModuleContext): ToolDefinition[] {
  return moduleTools[module] ?? coreTool;
}
