export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface DevolucionTaskItem {
  fila: number;
  isbn?: string;
  titulo?: string;
  cantidad: number;
  extras?: Record<string, string>;
  recibido: boolean;
}

export interface Task {
  id: string;
  title: string;
  department: string;
  status: "todo" | "in-progress" | "done";
  notes: string;
  subtasks: SubTask[];
  createdBy?: string;
  createdAt?: { toDate: () => Date } | null;
  order?: number;
  startDate?: string;
  dueDate?: string;
  devolucionItems?: DevolucionTaskItem[];
}

export const departments = ["General", "Devolución", "SAC", "Operaciones"];
