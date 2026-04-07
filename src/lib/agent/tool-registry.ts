import type { ToolDefinition, ModuleContext } from "./types";
import type { AgentModuleMap } from "@/lib/agent-modules";
import { taskTools } from "./tools/tasks";
import { requestTools } from "./tools/requests";
import { celesaTools } from "./tools/celesa";
import { productTools } from "./tools/products";
import { bookstoreTools } from "./tools/bookstore";
import { dashboardTools } from "./tools/dashboard";
import { inventoryTools } from "./tools/inventory";
import { emailDraftTools } from "./tools/email-draft";
import { knowledgeTools } from "./tools/knowledge";

const allTools: ToolDefinition[] = [
  ...taskTools,
  ...requestTools,
  ...celesaTools,
  ...productTools,
  ...bookstoreTools,
  ...dashboardTools,
  ...inventoryTools,
  ...emailDraftTools,
  ...knowledgeTools,
];

// Core tools always available (lightweight)
const coreTool = dashboardTools;

// Tools available in ALL module contexts (email, knowledge, inventory)
const universalTools: ToolDefinition[] = [
  ...emailDraftTools,
  ...knowledgeTools,
  ...inventoryTools,
];

// Map modules to their relevant tools to reduce token usage
const moduleTools: Partial<Record<ModuleContext, ToolDefinition[]>> = {
  "Dashboard": [...dashboardTools, ...taskTools.slice(0, 2), ...universalTools],
  "Tareas Personales": [...taskTools, ...universalTools],
  "Operaciones": [...dashboardTools.slice(0, 2), ...taskTools.filter(t => t.name.includes("Operations")), ...celesaTools, ...universalTools],
  "Celesa": [...celesaTools, ...universalTools],
  "Solicitudes": [...requestTools, ...universalTools],
  "Solicitudes Librerias": [...bookstoreTools, ...universalTools],
  "Hub de Solicitudes": [...requestTools, ...bookstoreTools, ...universalTools],
  "Reposicion": [...dashboardTools.slice(0, 2), ...productTools, ...universalTools],
  "Ingreso Mercancia": [...productTools, ...universalTools],
  "Scrap Bukz": [...productTools, ...universalTools],
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
inventoryTools.forEach((t) => toolModuleMapping.set(t, "inventory"));
emailDraftTools.forEach((t) => toolModuleMapping.set(t, "email"));
knowledgeTools.forEach((t) => toolModuleMapping.set(t, "knowledge"));

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
