import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StringDatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LeaveRequest } from "../requests/types";

interface EditPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequest | null;
  onSave: (
    requestId: string,
    updates: Partial<Pick<LeaveRequest, "fullName" | "idDocument" | "reason" | "startDate" | "endDate" | "customTypeLabel">>
  ) => Promise<void>;
}

const EditPermissionDialog = ({
  open,
  onOpenChange,
  request,
  onSave,
}: EditPermissionDialogProps) => {
  const [fullName, setFullName] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (request) {
      setFullName(request.fullName || "");
      setIdDocument(request.idDocument || "");
      setCustomTypeLabel(request.customTypeLabel || "");
      setStartDate(request.startDate || "");
      setEndDate(request.endDate || "");
      setReason(request.reason || "");
    }
  }, [request]);

  const handleSubmit = async () => {
    if (!request) return;
    setSubmitting(true);
    try {
      await onSave(request.id, {
        fullName: fullName.trim(),
        idDocument: idDocument.trim(),
        customTypeLabel: customTypeLabel.trim() || undefined,
        startDate,
        endDate,
        reason: reason.trim(),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Permiso</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Empleado</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre del empleado"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cédula</label>
            <Input
              value={idDocument}
              onChange={(e) => setIdDocument(e.target.value)}
              placeholder="Número de cédula del empleado"
              className="h-11"
            />
          </div>

          {request?.type === "custom" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del Permiso</label>
              <Input
                value={customTypeLabel}
                onChange={(e) => setCustomTypeLabel(e.target.value)}
                placeholder="Ej: Cita médica, Diligencia legal"
                className="h-11"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Inicio</label>
              <StringDatePicker
                value={startDate}
                onChange={setStartDate}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin</label>
              <StringDatePicker
                value={endDate}
                onChange={setEndDate}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opcional"
              className="h-11"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPermissionDialog;
