import {
  ShieldCheck,
  LayoutGrid,
  Truck,
  Home,
  type LucideIcon,
} from "lucide-react";
import { PAGE_REGISTRY } from "@/lib/pages";
import { WORKSPACE_IDS } from "@/lib/workspaces";
import {
  buildFullAgentPermissions,
  buildDefaultAgentPermissions,
  buildDisabledAgentPermissions,
  type AgentPermissions,
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
];
