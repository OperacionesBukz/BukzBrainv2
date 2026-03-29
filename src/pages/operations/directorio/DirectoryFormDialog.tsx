import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DIRECTORY_STATUSES } from "./types";
import type {
  DirectoryEntry,
  DirectoryType,
  DirectoryStatus,
  PersonEntry,
  SupplierEntry,
} from "./types";

interface DirectoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DirectoryType;
  entry?: DirectoryEntry | null;
  onSubmit: (
    data: Omit<DirectoryEntry, "id" | "createdBy" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  onUpdate?: (
    id: string,
    updates: Partial<Omit<DirectoryEntry, "id" | "createdAt" | "createdBy">>
  ) => Promise<void>;
}

const initialPerson = {
  nombre: "",
  apellido: "",
  cedula: "",
  celular: "",
  correo: "",
  estado: "Activo" as DirectoryStatus,
};

const initialSupplier = {
  empresa: "",
  razonSocial: "",
  nit: "",
  margen: "",
  correo: "",
  correos_cc: "",
  estado: "Activo" as DirectoryStatus,
};

export default function DirectoryFormDialog({
  open,
  onOpenChange,
  type,
  entry,
  onSubmit,
  onUpdate,
}: DirectoryFormDialogProps) {
  const isPersonType = type === "empleado" || type === "temporal";
  const isEditing = !!entry;

  const [personForm, setPersonForm] = useState({ ...initialPerson });
  const [supplierForm, setSupplierForm] = useState({ ...initialSupplier });

  useEffect(() => {
    if (entry && open) {
      if (isPersonType && "nombre" in entry) {
        const p = entry as PersonEntry;
        setPersonForm({
          nombre: p.nombre,
          apellido: p.apellido,
          cedula: p.cedula,
          celular: p.celular,
          correo: p.correo,
          estado: p.estado,
        });
      } else if (!isPersonType && "empresa" in entry) {
        const s = entry as SupplierEntry;
        setSupplierForm({
          empresa: s.empresa,
          razonSocial: s.razonSocial,
          nit: s.nit,
          margen: String(s.margen),
          correo: s.correo || "",
          correos_cc: (s.correos_cc || []).join("; "),
          estado: s.estado,
        });
      }
    } else if (open) {
      setPersonForm({ ...initialPerson });
      setSupplierForm({ ...initialSupplier });
    }
  }, [entry, open, isPersonType]);

  const handleSubmit = async () => {
    if (isPersonType) {
      if (!personForm.nombre.trim() || !personForm.apellido.trim()) return;
      const data = {
        type,
        nombre: personForm.nombre.trim(),
        apellido: personForm.apellido.trim(),
        cedula: personForm.cedula.trim(),
        celular: personForm.celular.trim(),
        correo: personForm.correo.trim(),
        estado: personForm.estado,
      } as Omit<PersonEntry, "id" | "createdBy" | "createdAt" | "updatedAt">;

      if (isEditing && onUpdate && entry) {
        await onUpdate(entry.id, data);
      } else {
        await onSubmit(data);
      }
    } else {
      if (!supplierForm.empresa.trim()) return;
      const data = {
        type: "proveedor" as const,
        empresa: supplierForm.empresa.trim(),
        razonSocial: supplierForm.razonSocial.trim(),
        nit: supplierForm.nit.trim(),
        margen: parseFloat(supplierForm.margen) || 0,
        correo: supplierForm.correo.trim(),
        correos_cc: supplierForm.correos_cc
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
        estado: supplierForm.estado,
      } as Omit<SupplierEntry, "id" | "createdBy" | "createdAt" | "updatedAt">;

      if (isEditing && onUpdate && entry) {
        await onUpdate(entry.id, data);
      } else {
        await onSubmit(data);
      }
    }
    onOpenChange(false);
  };

  const typeLabel =
    type === "empleado"
      ? "empleado"
      : type === "temporal"
        ? "temporal"
        : "proveedor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar" : "Agregar"} {typeLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isPersonType ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nombre *</label>
                  <Input
                    value={personForm.nombre}
                    onChange={(e) =>
                      setPersonForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                    placeholder="Nombre"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Apellido *</label>
                  <Input
                    value={personForm.apellido}
                    onChange={(e) =>
                      setPersonForm((f) => ({
                        ...f,
                        apellido: e.target.value,
                      }))
                    }
                    placeholder="Apellido"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cédula</label>
                <Input
                  value={personForm.cedula}
                  onChange={(e) =>
                    setPersonForm((f) => ({ ...f, cedula: e.target.value }))
                  }
                  placeholder="Cédula"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Celular</label>
                <Input
                  value={personForm.celular}
                  onChange={(e) =>
                    setPersonForm((f) => ({ ...f, celular: e.target.value }))
                  }
                  placeholder="Celular"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correo</label>
                <Input
                  type="email"
                  value={personForm.correo}
                  onChange={(e) =>
                    setPersonForm((f) => ({ ...f, correo: e.target.value }))
                  }
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Empresa *</label>
                <Input
                  value={supplierForm.empresa}
                  onChange={(e) =>
                    setSupplierForm((f) => ({
                      ...f,
                      empresa: e.target.value,
                    }))
                  }
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Razón Social</label>
                <Input
                  value={supplierForm.razonSocial}
                  onChange={(e) =>
                    setSupplierForm((f) => ({
                      ...f,
                      razonSocial: e.target.value,
                    }))
                  }
                  placeholder="Razón social"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">NIT</label>
                <Input
                  value={supplierForm.nit}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, nit: e.target.value }))
                  }
                  placeholder="NIT"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Margen %</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={supplierForm.margen}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, margen: e.target.value }))
                  }
                  placeholder="30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correo</label>
                <Input
                  type="email"
                  value={supplierForm.correo}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, correo: e.target.value }))
                  }
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correos CC</label>
                <Input
                  value={supplierForm.correos_cc}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, correos_cc: e.target.value }))
                  }
                  placeholder="cc1@ejemplo.com; cc2@ejemplo.com"
                />
                <p className="text-xs text-muted-foreground">
                  Separar con punto y coma (;)
                </p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Estado</label>
            <select
              value={isPersonType ? personForm.estado : supplierForm.estado}
              onChange={(e) => {
                const val = e.target.value as DirectoryStatus;
                if (isPersonType) {
                  setPersonForm((f) => ({ ...f, estado: val }));
                } else {
                  setSupplierForm((f) => ({ ...f, estado: val }));
                }
              }}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DIRECTORY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {isEditing ? "Guardar" : "Agregar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
