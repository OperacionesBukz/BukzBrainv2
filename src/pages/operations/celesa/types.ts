import { Timestamp } from "firebase/firestore";

export type CelesaStatus =
  | "Pendiente"
  | "Confirmado"
  | "Entregado"
  | "Atrasado"
  | "Agotado";

export interface CelesaOrder {
  id: string;
  numeroPedido: string;
  cliente: string;
  producto: string;
  isbn: string;
  fechaPedido: string;
  estado: CelesaStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export const CELESA_STATUS_CONFIG: Record<
  CelesaStatus,
  { label: string; bg: string; text: string; dot?: string }
> = {
  Pendiente: {
    label: "Pendiente",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  },
  Confirmado: {
    label: "Confirmado",
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-700 dark:text-yellow-300",
  },
  Entregado: {
    label: "Entregado",
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
  },
  Atrasado: {
    label: "Atrasado",
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  Agotado: {
    label: "Agotado",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-500 dark:text-gray-400",
  },
};

export const CELESA_STATUSES: CelesaStatus[] = [
  "Pendiente",
  "Confirmado",
  "Entregado",
  "Atrasado",
  "Agotado",
];

export function businessDaysSince(dateStr: string): number {
  const start = new Date(dateStr + "T00:00:00");
  const end = new Date();
  if (isNaN(start.getTime())) return 0;

  let count = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
