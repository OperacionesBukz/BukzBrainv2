import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "sonner";

interface UserOption {
  uid: string;
  email: string;
  displayName: string;
}

interface AdminAddPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AdminAddPermissionDialog = ({
  open,
  onOpenChange,
}: AdminAddPermissionDialogProps) => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: UserOption[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          email: docSnap.id,
          displayName: data.displayName || docSnap.id.split("@")[0],
          uid: data.uid || "",
        });
      });
      setUsers(list.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setSelectedUserId("");
    setCustomTypeLabel("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setStatus("approved");
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !customTypeLabel.trim() || !startDate || !endDate) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    const selectedUser = users.find((u) => u.uid === selectedUserId);
    if (!selectedUser) {
      toast.error("Usuario no encontrado");
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
        fullName: selectedUser.displayName,
        userId: selectedUser.uid,
        userEmail: selectedUser.email,
        createdAt: serverTimestamp(),
      });

      toast.success("Permiso registrado correctamente");
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding permission:", error);
      toast.error("Error al registrar el permiso: " + error.message);
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
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecciona un empleado" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.uid} value={u.uid}>
                    {u.displayName} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin *</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
