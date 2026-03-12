import { LayoutGrid, Truck, type LucideIcon } from "lucide-react";
import { PAGE_REGISTRY } from "@/lib/pages";

export type WorkspaceId = "general" | "operaciones";

export interface WorkspaceConfig {
  id: WorkspaceId;
  label: string;
  icon: LucideIcon;
  paths: string[];
  showAdmin: boolean;
}

const generalPaths = PAGE_REGISTRY
  .filter((p) => p.workspace === "general" || p.workspace === "both")
  .map((p) => p.path);

const operacionesPaths = PAGE_REGISTRY
  .filter((p) => p.workspace === "operaciones" || p.workspace === "both")
  .map((p) => p.path);

export const WORKSPACES: Record<WorkspaceId, WorkspaceConfig> = {
  general: {
    id: "general",
    label: "General",
    icon: LayoutGrid,
    paths: generalPaths,
    showAdmin: true,
  },
  operaciones: {
    id: "operaciones",
    label: "Operaciones",
    icon: Truck,
    paths: operacionesPaths,
    showAdmin: true,
  },
};

export const WORKSPACE_IDS = Object.keys(WORKSPACES) as WorkspaceId[];
export const DEFAULT_WORKSPACE: WorkspaceId = "general";
