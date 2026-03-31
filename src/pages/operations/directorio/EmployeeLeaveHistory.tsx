import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Loader2, Palmtree, Briefcase, Ban, Cake, FileText, CheckCircle2, XCircle, Clock4 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaveRequest, DisplayStatus } from "@/pages/requests/types";
import { getDisplayStatus, requestTypeConfig } from "@/pages/requests/types";

const STATUS_DISPLAY: Record<DisplayStatus, { label: string; className: string; icon: typeof Clock4 }> = {
  pending: {
    label: "Pendiente",
    icon: Clock4,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  approved: {
    label: "Aprobado",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rechazado",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  active: {
    label: "En Vacaciones",
    icon: Palmtree,
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  finished: {
    label: "Finalizado",
    icon: CheckCircle2,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

const TYPE_ICONS: Record<string, typeof Palmtree> = {
  vacation: Palmtree,
  "paid-leave": Briefcase,
  "unpaid-leave": Ban,
  "birthday-leave": Cake,
  custom: FileText,
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

interface EmployeeLeaveHistoryProps {
  cedula: string;
}

export default function EmployeeLeaveHistory({ cedula }: EmployeeLeaveHistoryProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cedula) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchRequests() {
      try {
        // Query with where only, sort client-side to avoid composite index requirement
        const q = query(
          collection(db, "leave_requests"),
          where("idDocument", "==", cedula)
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;

        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as LeaveRequest[];

        // Sort by createdAt descending client-side
        list.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() ?? 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() ?? 0;
          return dateB - dateA;
        });

        setRequests(list);
      } catch {
        // Silently handle - empty history is acceptable
        setRequests([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRequests();
    return () => { cancelled = true; };
  }, [cedula]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-6 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-4 px-6 text-muted-foreground text-sm">
        Sin historial de permisos
      </div>
    );
  }

  return (
    <div className="py-3 px-6">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Historial de Permisos ({requests.length})
      </p>
      <div className="space-y-2">
        {requests.map((req) => {
          const displayStatus = getDisplayStatus(req);
          const statusConfig = STATUS_DISPLAY[displayStatus];
          const StatusIcon = statusConfig.icon;
          const typeConfig = requestTypeConfig.find((t) => t.value === req.type);
          const TypeIcon = TYPE_ICONS[req.type] || FileText;

          return (
            <div
              key={req.id}
              className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium min-w-[120px]">
                {req.customTypeLabel || typeConfig?.label || req.type}
              </span>
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {formatDate(req.startDate)} — {formatDate(req.endDate)}
              </span>
              <Badge
                variant="secondary"
                className={cn("ml-auto shrink-0 gap-1 text-xs", statusConfig.className)}
              >
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
              {req.reason && (
                <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[200px]" title={req.reason}>
                  {req.reason}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
