export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
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
}

export const departments = ["General", "Devolución", "SAC", "Operaciones"];
