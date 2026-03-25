export const AGENT_MODULES = [
  { id: "tasks", label: "Tareas", description: "Crear, editar y consultar tareas" },
  { id: "requests", label: "Solicitudes", description: "Gestionar solicitudes de permisos" },
  { id: "celesa", label: "Celesa", description: "Consultar pedidos Celesa" },
  { id: "products", label: "Productos", description: "Buscar productos e inventario" },
  { id: "bookstore", label: "Librerias", description: "Solicitudes de librerias" },
  { id: "dashboard", label: "Dashboard", description: "Resumen y briefing diario" },
] as const;

export type AgentModuleId = (typeof AGENT_MODULES)[number]["id"];
export type AgentModuleMap = Record<AgentModuleId, boolean>;

export interface AgentPermissions {
  enabled: boolean;
  modules: AgentModuleMap;
}

export const buildDefaultAgentPermissions = (): AgentPermissions => ({
  enabled: false,
  modules: Object.fromEntries(AGENT_MODULES.map((m) => [m.id, true])) as AgentModuleMap,
});

export const buildFullAgentPermissions = (): AgentPermissions => ({
  enabled: true,
  modules: Object.fromEntries(AGENT_MODULES.map((m) => [m.id, true])) as AgentModuleMap,
});

export const buildDisabledAgentPermissions = (): AgentPermissions => ({
  enabled: false,
  modules: Object.fromEntries(AGENT_MODULES.map((m) => [m.id, false])) as AgentModuleMap,
});
