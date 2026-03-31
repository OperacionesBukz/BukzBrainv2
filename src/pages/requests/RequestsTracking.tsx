import { useState } from "react";
import { Palmtree, Briefcase, Cake, FileText, History, CheckCircle2, XCircle, Clock4, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusDropdown, { StatusOption } from "@/components/StatusDropdown";
import EditPermissionDialog from "@/pages/requests-hub/EditPermissionDialog";
import { LeaveRequest, requestTypeConfig, DisplayStatus, getDisplayStatus } from "./types";

type LeaveStatus = "pending" | "approved" | "rejected";

const LEAVE_STATUS_CONFIG: Record<DisplayStatus, StatusOption> = {
  pending: {
    label: "Pendiente",
    icon: Clock4,
    iconClassName: "text-amber-500",
    badgeVariant: "secondary",
  },
  approved: {
    label: "Aprobado",
    icon: CheckCircle2,
    iconClassName: "text-emerald-500",
    badgeVariant: "default",
    badgeClassName: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  },
  rejected: {
    label: "Rechazado",
    icon: XCircle,
    iconClassName: "text-destructive",
    badgeVariant: "destructive",
    badgeClassName: "bg-destructive/10 text-destructive border-destructive/20",
    menuItemClassName: "text-destructive focus:text-destructive",
  },
  active: {
    label: "En Vacaciones",
    icon: Palmtree,
    iconClassName: "text-cyan-500",
    badgeVariant: "default",
    badgeClassName: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  },
  finished: {
    label: "Finalizado",
    icon: CheckCircle2,
    iconClassName: "text-muted-foreground",
    badgeVariant: "secondary",
    badgeClassName: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
};

const LEAVE_DROPDOWN_CONFIG: Record<LeaveStatus, StatusOption> = {
  pending: LEAVE_STATUS_CONFIG.pending,
  approved: LEAVE_STATUS_CONFIG.approved,
  rejected: LEAVE_STATUS_CONFIG.rejected,
};

interface RequestsTrackingProps {
  requests: LeaveRequest[];
  isOperations: boolean;
  isMobile: boolean;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
  updateRequestStatus: (requestId: string, newStatus: LeaveStatus) => Promise<void>;
  updateLeaveRequest?: (
    requestId: string,
    updates: Partial<Pick<LeaveRequest, "fullName" | "idDocument" | "reason" | "startDate" | "endDate" | "customTypeLabel">>
  ) => Promise<void>;
  deleteRequest: (requestId: string) => Promise<void>;
}

const RequestsTracking = ({
  requests,
  isOperations,
  isMobile,
  getStatusIcon,
  getStatusBadge,
  updateRequestStatus,
  updateLeaveRequest,
  deleteRequest,
}: RequestsTrackingProps) => {
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        {!isMobile ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                {isOperations && <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solicitante</th>}
                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Celular</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fechas</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivo</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviado</th>
                {isOperations && <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 md:px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <History className="h-8 w-8 opacity-20" />
                      <p>No hay solicitudes registradas.</p>
                    </div>
                  </td>
                </tr>
              ) : (
              requests.map((request) => (
                <tr key={request.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted border border-border text-foreground dark:border-transparent dark:bg-primary/10 dark:text-primary">
                        {request.type === 'vacation' ? <Palmtree className="h-4 w-4" /> :
                          request.type === 'birthday-leave' ? <Cake className="h-4 w-4" /> :
                            request.type === 'custom' ? <FileText className="h-4 w-4" /> :
                              <Briefcase className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {request.type === 'custom' ? request.customTypeLabel || 'Personalizado' : requestTypeConfig.find(t => t.value === request.type)?.label}
                      </span>
                    </div>
                  </td>
                  {isOperations && (
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col text-sm">
                        <span className="font-medium text-foreground">{request.fullName || "Sin nombre"}</span>
                        <span className="text-xs text-muted-foreground">{request.branch || "Sin sede"}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-foreground">
                    {request.phoneNumber || "\u2014"}
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="flex flex-col text-sm">
                      <span className="text-foreground">{request.startDate} al {request.endDate}</span>
                      {request.returnDate && <span className="text-xs text-muted-foreground italic">Reingreso: {request.returnDate}</span>}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-foreground max-w-xs truncate">
                    {request.reason || "\u2014"}
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="flex items-center gap-2">
                      {isOperations ? (
                        <StatusDropdown
                          statusConfig={LEAVE_DROPDOWN_CONFIG}
                          currentStatus={request.status as LeaveStatus}
                          onStatusChange={(newStatus) => updateRequestStatus(request.id, newStatus)}
                        />
                      ) : (
                        <>
                          {getStatusIcon(getDisplayStatus(request))}
                          {getStatusBadge(getDisplayStatus(request))}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-muted-foreground">
                    {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleDateString() : "Reciente"}
                  </td>
                  {isOperations && (
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {updateLeaveRequest && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingRequest(request)}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRequest(request.id)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        ) : (
          <div className="space-y-3 p-3">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <History className="h-8 w-8 opacity-20" />
                <p>No hay solicitudes registradas.</p>
              </div>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                  {/* Header del card: tipo + badge status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-muted border border-border text-foreground dark:border-transparent dark:bg-primary/10 dark:text-primary">
                        {request.type === 'vacation' ? <Palmtree className="h-4 w-4" /> :
                          request.type === 'birthday-leave' ? <Cake className="h-4 w-4" /> :
                            request.type === 'custom' ? <FileText className="h-4 w-4" /> :
                              <Briefcase className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {request.type === 'custom' ? request.customTypeLabel || 'Personalizado' : requestTypeConfig.find(t => t.value === request.type)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isOperations ? (
                        <StatusDropdown
                          statusConfig={LEAVE_DROPDOWN_CONFIG}
                          currentStatus={request.status as LeaveStatus}
                          onStatusChange={(newStatus) => updateRequestStatus(request.id, newStatus)}
                          align="end"
                        />
                      ) : (
                        <>
                          {getStatusIcon(getDisplayStatus(request))}
                          {getStatusBadge(getDisplayStatus(request))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Info del solicitante (solo si isOperations) */}
                  {isOperations && (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{request.fullName || "Sin nombre"}</span>
                      <span className="text-xs text-muted-foreground block">{request.branch || "Sin sede"}</span>
                    </div>
                  )}

                  {/* Detalles */}
                  <div className="text-sm space-y-1.5">
                    <div>
                      <span className="text-muted-foreground text-xs">Fechas:</span>{" "}
                      <span className="font-medium text-foreground">{request.startDate} - {request.endDate}</span>
                      {request.returnDate && <span className="text-xs text-muted-foreground block italic">Reingreso: {request.returnDate}</span>}
                    </div>
                    {request.phoneNumber && (
                      <div>
                        <span className="text-muted-foreground text-xs">Teléfono:</span>{" "}
                        <span className="text-foreground">{request.phoneNumber}</span>
                      </div>
                    )}
                    {request.reason && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium">Motivo:</span> {request.reason}
                      </div>
                    )}
                  </div>

                  {/* Footer: fecha creación + botón eliminar */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      Enviado: {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleDateString() : "Reciente"}
                    </span>
                    {isOperations && (
                      <div className="flex gap-1">
                        {updateLeaveRequest && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRequest(request)}
                            className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRequest(request.id)}
                          className="h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {updateLeaveRequest && (
        <EditPermissionDialog
          open={editingRequest !== null}
          onOpenChange={(open) => !open && setEditingRequest(null)}
          request={editingRequest}
          onSave={updateLeaveRequest}
        />
      )}
    </div>
  );
};

export default RequestsTracking;
