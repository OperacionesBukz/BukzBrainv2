import { ClipboardList, CalendarDays, Store, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LeaveRequest } from "../requests/types";
import type { RequestOrder } from "../bookstore/types";

interface RequestsHubKpiCardsProps {
  leaveRequests: LeaveRequest[];
  bookstoreOrders: RequestOrder[];
}

export default function RequestsHubKpiCards({
  leaveRequests,
  bookstoreOrders,
}: RequestsHubKpiCardsProps) {
  const pendingLeave = leaveRequests.filter((r) => r.status === "pending").length;
  const pendingOrders = bookstoreOrders.filter((o) => o.status === "pending").length;
  const approvedLeave = leaveRequests.filter((r) => r.status === "approved").length;

  const cards = [
    {
      label: "Total Pendientes",
      value: pendingLeave + pendingOrders,
      icon: ClipboardList,
      color: "text-foreground",
    },
    {
      label: "Permisos Pendientes",
      value: pendingLeave,
      icon: CalendarDays,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Pedidos Librerías Pendientes",
      value: pendingOrders,
      icon: Store,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Permisos Aprobados",
      value: approvedLeave,
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <c.icon className={`h-5 w-5 shrink-0 ${c.color}`} />
            <div>
              <p className="text-2xl font-bold leading-none">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
