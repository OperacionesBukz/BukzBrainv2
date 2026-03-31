import {
  ShieldCheck,
  LayoutGrid,
  Truck,
  Home,
  Users,
  Landmark,
  Store,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { PAGE_REGISTRY } from "@/lib/pages";
import { WORKSPACE_IDS } from "@/lib/workspaces";
import {
  AGENT_MODULES,
  buildFullAgentPermissions,
  buildDefaultAgentPermissions,
  buildDisabledAgentPermissions,
  type AgentPermissions,
  type AgentModuleMap,
} from "@/lib/agent-modules";
import type { PageMap, WorkspaceMap } from "./usePermissionsData";

export interface PermissionTemplate {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  pages: PageMap;
  workspaces: WorkspaceMap;
  agent: AgentPermissions;
}

const allPagesTrue = (): PageMap =>
  Object.fromEntries(PAGE_REGISTRY.map((p) => [p.path, true]));

const allWorkspacesTrue = (): WorkspaceMap =>
  Object.fromEntries(WORKSPACE_IDS.map((id) => [id, true]));

const generalOnlyPages = (): PageMap =>
  Object.fromEntries(
    PAGE_REGISTRY.map((p) => [
      p.path,
      p.workspace === "general" || p.workspace === "both",
    ])
  );

const operadorPages = (): PageMap =>
  Object.fromEntries(
    PAGE_REGISTRY.map((p) => [
      p.path,
      p.workspace === "operaciones" || p.workspace === "both",
    ])
  );

const minimalPages = (): PageMap =>
  Object.fromEntries(
    PAGE_REGISTRY.map((p) => [p.path, p.path === "/dashboard"])
  );

const pickPages = (allowed: string[]): PageMap =>
  Object.fromEntries(
    PAGE_REGISTRY.map((p) => [p.path, allowed.includes(p.path)])
  );

const pickAgentModules = (allowed: string[]): AgentPermissions => ({
  enabled: true,
  modules: Object.fromEntries(
    AGENT_MODULES.map((m) => [m.id, allowed.includes(m.id)])
  ) as AgentModuleMap,
});

export const PERMISSION_TEMPLATES: PermissionTemplate[] = [
  {
    id: "full-access",
    label: "Acceso Completo",
    description: "Todas las paginas, workspaces y agente",
    icon: ShieldCheck,
    pages: allPagesTrue(),
    workspaces: allWorkspacesTrue(),
    agent: buildFullAgentPermissions(),
  },
  {
    id: "general-only",
    label: "Solo General",
    description: "Solo paginas del workspace General",
    icon: LayoutGrid,
    pages: generalOnlyPages(),
    workspaces: { general: true, operaciones: false },
    agent: buildDefaultAgentPermissions(),
  },
  {
    id: "operator",
    label: "Operador",
    description: "Solo paginas de Operaciones",
    icon: Truck,
    pages: operadorPages(),
    workspaces: { general: true, operaciones: true },
    agent: buildDefaultAgentPermissions(),
  },
  {
    id: "minimal",
    label: "Minimo",
    description: "Solo Dashboard",
    icon: Home,
    pages: minimalPages(),
    workspaces: { general: true, operaciones: false },
    agent: buildDisabledAgentPermissions(),
  },
  /* ── Departamentos ─────────────────────────────────── */
  {
    id: "dept-rrhh",
    label: "Recursos Humanos",
    description: "Solicitudes, directorio, tareas y guías",
    icon: Users,
    pages: pickPages([
      "/dashboard",
      "/operations",
      "/tasks",
      "/instructions",
      "/requests",
      "/directorio",
    ]),
    workspaces: { general: true, operaciones: true },
    agent: pickAgentModules(["tasks", "requests", "dashboard"]),
  },
  {
    id: "dept-contabilidad",
    label: "Contabilidad",
    description: "Dashboard, calculadora, tareas y guías",
    icon: Landmark,
    pages: pickPages([
      "/dashboard",
      "/operations",
      "/tasks",
      "/instructions",
      "/requests",
      "/calculator",
    ]),
    workspaces: { general: true, operaciones: false },
    agent: pickAgentModules(["tasks", "dashboard"]),
  },
  {
    id: "dept-tiendas",
    label: "Tiendas",
    description: "Solicitud librerías, tareas y guías",
    icon: Store,
    pages: pickPages([
      "/dashboard",
      "/operations",
      "/tasks",
      "/instructions",
      "/requests",
      "/bookstore-requests",
    ]),
    workspaces: { general: true, operaciones: false },
    agent: pickAgentModules(["tasks", "bookstore", "dashboard"]),
  },
  {
    id: "dept-bodega",
    label: "Bodega",
    description: "Pedidos, workflow, directorio y tareas",
    icon: Warehouse,
    pages: pickPages([
      "/dashboard",
      "/operations",
      "/tasks",
      "/instructions",
      "/requests",
      "/reposiciones-menu",
      "/workflow",
      "/directorio",
    ]),
    workspaces: { general: true, operaciones: true },
    agent: pickAgentModules(["tasks", "products", "dashboard"]),
  },
];
