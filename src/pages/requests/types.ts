import { Palmtree, Briefcase, Ban, Cake } from "lucide-react";

export type RequestType = "vacation" | "paid-leave" | "unpaid-leave" | "birthday-leave" | "custom";

export interface LeaveRequest {
  id: string;
  type: RequestType;
  customTypeLabel?: string;
  fullName?: string;
  idDocument?: string;
  role?: string;
  branch?: string;
  phoneNumber?: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  returnDate?: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: { toDate: () => Date } | null;
  userId: string;
  userEmail: string;
}

export interface RequestFormState {
  fullName: string;
  idDocument: string;
  role: string;
  branch: string;
  phoneNumber: string;
  supervisor: string;
  startDate: string;
  endDate: string;
  returnDate: string;
  reason: string;
}

export type DisplayStatus = "pending" | "approved" | "rejected" | "active" | "finished";

export function getDisplayStatus(request: LeaveRequest): DisplayStatus {
  if (request.status !== "approved") return request.status;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(request.startDate + "T00:00:00");
  const end = new Date(request.endDate + "T00:00:00");

  if (today > end) return "finished";
  if (today >= start && today <= end) return "active";
  return "approved";
}

export const requestTypeConfig: {
  value: RequestType;
  label: string;
  description: string;
  icon: typeof Palmtree;
  color: string;
}[] = [
    { value: "vacation", label: "Vacaciones", description: "Tiempo libre para viajes o descanso", icon: Palmtree, color: "text-primary-foreground" },
    { value: "paid-leave", label: "Permiso Remunerado", description: "Permiso personal o por enfermedad", icon: Briefcase, color: "text-primary-foreground" },
    { value: "unpaid-leave", label: "Permiso No Remunerado", description: "Tiempo libre sin pago", icon: Ban, color: "text-primary-foreground" },
    { value: "birthday-leave", label: "Día de Cumpleaños", description: "Día libre por tu cumpleaños", icon: Cake, color: "text-primary-foreground" },
  ];
