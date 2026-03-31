import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { createNotificationForAdmins } from "@/lib/notifications";

interface AdminAddPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AdminAddPermissionDialog = ({
  open,
  onOpenChange,
}: AdminAddPermissionDialogProps) => {
  const [employeeName, setEmployeeName] = useState("");
  const [idDocument, setIdDocument] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setEmployeeName("");
    setIdDocument("");
    setCustomTypeLabel("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setStatus("approved");
  };

  const handleSubmit = async () => {
    if (!employeeName.trim() || !customTypeLabel.trim() || !startDate || !endDate) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "leave_requests"), {
        type: "custom",
        customTypeLabel: customTypeLabel.trim(),
        startDate,
        endDate,
        reason: reason.trim(),
        status,
        fullName: employeeName.trim(),
        idDocument: idDocument.trim(),
        createdAt: serverTimestamp(),
      });

      // Fire-and-forget notification to all admins
      createNotificationForAdmins({
        type: "leave_request_created",
        title: "Nuevo permiso registrado",
        message: `Se registró un permiso para ${employeeName.trim()}: ${customTypeLabel.trim()}`,
        resourcePath: "/requests-hub",
      }).catch((err) => console.warn("[notifications] Error:", err));

      toast.success("Permiso registrado correctamente");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding permission:", error);
      toast.error("Error al registrar el permiso: " + (error instanceof Error ? error.message : "Error desconocido"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar Permiso</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Empleado *</label>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre del Permiso *</label>
            <Input
              value={customTypeLabel}
              onChange={(e) => setCustomTypeLabel(e.target.value)}
              placeholder="Ej: Cita médica, Diligencia legal, etc."
              className="h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Inicio *</label>
              <StringDatePicker
                value={startDate}
                onChange={setStartDate}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin *</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Estado</label>
            <Select value={status} onValueChange={(v) => setStatus(v as "pending" | "approved" | "rejected")}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Aprobado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="rejected">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar Permiso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAddPermissionDialog;
