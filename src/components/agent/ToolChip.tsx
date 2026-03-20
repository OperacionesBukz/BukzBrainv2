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
  getCelesaStats: "Estadísticas Celesa",
  searchProducts: "Buscar productos",
  getProductInventory: "Consultar inventario",
  listBookstoreRequests: "Solicitudes librerías",
  updateBookstoreRequest: "Actualizar solicitud librería",
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
