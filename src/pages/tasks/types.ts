import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  priority: string;
  status: "todo" | "done";
  notes: string;
  subtasks: SubTask[];
  userId: string;
  createdAt: any;
  order?: number;
  assignedTo?: string;
  assignedBy?: string;
  startDate?: string;
  dueDate?: string;
}

export const priorities = ["Baja", "Media", "Alta", "Urgente"];

export const adminEmails = ["operaciones@bukz.co", "cedi@bukz.co", "ux@bukz.co"];

export const assignableUsers = [
  { email: "operaciones@bukz.co", label: "Operaciones" },
  { email: "cedi@bukz.co", label: "CEDI" },
  { email: "ux@bukz.co", label: "UX" },
];

export const priorityColor: Record<string, string> = {
  Baja: "bg-muted text-muted-foreground border border-border",
  Media: "bg-info/15 text-info",
  Alta: "bg-warning/15 text-warning",
  Urgente: "bg-destructive/15 text-destructive",
};

export const formatDate = (d: string) => format(new Date(d + "T00:00:00"), "dd MMM", { locale: es });

export const toDate = (s: string | undefined): Date | undefined =>
  s ? new Date(s + "T00:00:00") : undefined;
