import type { ToolDefinition, ModuleContext } from "./types";
import type { AgentModuleMap } from "@/lib/agent-modules";
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

// Map tool arrays to their agent module id
const toolModuleMapping = new Map<ToolDefinition, string>();
taskTools.forEach((t) => toolModuleMapping.set(t, "tasks"));
requestTools.forEach((t) => toolModuleMapping.set(t, "requests"));
celesaTools.forEach((t) => toolModuleMapping.set(t, "celesa"));
productTools.forEach((t) => toolModuleMapping.set(t, "products"));
bookstoreTools.forEach((t) => toolModuleMapping.set(t, "bookstore"));
dashboardTools.forEach((t) => toolModuleMapping.set(t, "dashboard"));

export function getAllTools(): ToolDefinition[] {
  return allTools;
}

export function getToolsForModule(
  module: ModuleContext,
  allowedModules?: AgentModuleMap
): ToolDefinition[] {
  let tools = moduleTools[module] ?? coreTool;

  if (allowedModules) {
    tools = tools.filter((tool) => {
      const moduleId = toolModuleMapping.get(tool);
      return moduleId ? (allowedModules[moduleId as keyof AgentModuleMap] ?? true) : true;
    });
  }

  return tools;
}
