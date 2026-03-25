import {
  Home,
  ListChecks,
  ClipboardList,
  BookOpen,
  CalendarDays,
  Store,
  Package,
  Ship,
  ClipboardCheck,
  Calculator,
  PackageSearch,
  SearchCode,
  Scissors,
  ContactRound,
  GitBranchPlus,
  type LucideIcon,
} from "lucide-react";
export type WorkspaceId = "general" | "operaciones";

export interface PageDefinition {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  workspace: WorkspaceId | "both";
}

export const PAGE_REGISTRY: PageDefinition[] = [
  { path: "/dashboard", label: "Dashboard", description: "Página principal", icon: Home, workspace: "general" },
  { path: "/operations", label: "Tareas Bukz", description: "Tablero de tareas entre áreas", icon: ListChecks, workspace: "both" },
  { path: "/tasks", label: "Tareas", description: "Gestor de tareas personales", icon: ClipboardList, workspace: "both" },
  { path: "/instructions", label: "Guías", description: "Base de conocimiento", icon: BookOpen, workspace: "general" },
  { path: "/requests", label: "Solicitudes", description: "Permisos y vacaciones", icon: CalendarDays, workspace: "general" },
  { path: "/bookstore-requests", label: "Solicitud Librerías", description: "Pedidos para librerías", icon: Store, workspace: "general" },
  { path: "/requests-hub", label: "Hub Solicitudes", description: "Seguimiento centralizado de solicitudes", icon: ClipboardCheck, workspace: "operaciones" },
  { path: "/reposicion", label: "Reposición", description: "Gestión de reposición", icon: Package, workspace: "operaciones" },
  { path: "/celesa", label: "Celesa", description: "Pedidos Celesa", icon: Ship, workspace: "operaciones" },
  { path: "/workflow", label: "Workflow", description: "Ingreso de mercancía, scrap y cortes", icon: GitBranchPlus, workspace: "operaciones" },
  { path: "/directorio", label: "Directorio", description: "Base de datos de empleados, temporales y proveedores", icon: ContactRound, workspace: "operaciones" },
  { path: "/calculator", label: "Calculadora", description: "Conversor EUR a COP", icon: Calculator, workspace: "general" },
];

export const ALL_PAGE_PATHS = PAGE_REGISTRY.map((p) => p.path);
