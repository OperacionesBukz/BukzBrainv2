import { useState, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, DIRECTORY_STATUSES, isPerson } from "./types";
import type {
  DirectoryEntry,
  DirectoryType,
  DirectoryStatus,
  PersonEntry,
  SupplierEntry,
} from "./types";

interface DirectoryTableProps {
  entries: DirectoryEntry[];
  type: DirectoryType;
  onAdd: (
    data: Omit<DirectoryEntry, "id" | "createdBy" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  onUpdate: (
    id: string,
    updates: Partial<Omit<DirectoryEntry, "id" | "createdAt" | "createdBy">>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isAdmin: boolean;
}

type PersonField = "nombre" | "apellido" | "cedula" | "celular" | "correo";
type SupplierField = "empresa" | "razonSocial" | "nit" | "margen";
type EditableField = PersonField | SupplierField;

interface EditingCell {
  entryId: string;
  field: EditableField;
}

const emptyPerson = {
  nombre: "",
  apellido: "",
  cedula: "",
  celular: "",
  correo: "",
  estado: "Activo" as DirectoryStatus,
};

const emptySupplier = {
  empresa: "",
  razonSocial: "",
  nit: "",
  margen: "",
  estado: "Activo" as DirectoryStatus,
};

export default function DirectoryTable({
  entries,
  type,
  onAdd,
  onUpdate,
  onDelete,
  isAdmin,
}: DirectoryTableProps) {
  const isPersonType = type === "empleado" || type === "temporal";
  const [newRow, setNewRow] = useState(
    isPersonType ? { ...emptyPerson } : { ...emptySupplier }
  );
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddRow = async () => {
    if (isPersonType) {
      const p = newRow as typeof emptyPerson;
      if (!p.nombre.trim() || !p.apellido.trim()) return;
      await onAdd({
        type,
        nombre: p.nombre.trim(),
        apellido: p.apellido.trim(),
        cedula: p.cedula.trim(),
        celular: p.celular.trim(),
        correo: p.correo.trim(),
        estado: p.estado,
      } as Omit<PersonEntry, "id" | "createdBy" | "createdAt" | "updatedAt">);
      setNewRow({ ...emptyPerson });
    } else {
      const s = newRow as typeof emptySupplier;
      if (!s.empresa.trim()) return;
      await onAdd({
        type: "proveedor",
        empresa: s.empresa.trim(),
        razonSocial: s.razonSocial.trim(),
        nit: s.nit.trim(),
        margen: parseFloat(s.margen) || 0,
        estado: s.estado,
      } as Omit<SupplierEntry, "id" | "createdBy" | "createdAt" | "updatedAt">);
      setNewRow({ ...emptySupplier });
    }
  };

  const startEdit = (entryId: string, field: EditableField, currentValue: string) => {
    setEditingCell({ entryId, field });
    setEditValue(currentValue);
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const entry = entries.find((e) => e.id === editingCell.entryId);
    if (!entry) return;

    const currentValue = String(
      (entry as Record<string, unknown>)[editingCell.field] ?? ""
    );
    if (editValue === currentValue) {
      setEditingCell(null);
      return;
    }

    const value =
      editingCell.field === "margen" ? parseFloat(editValue) || 0 : editValue;
    await onUpdate(editingCell.entryId, { [editingCell.field]: value });
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const renderEditableCell = (
    entry: DirectoryEntry,
    field: EditableField,
    displayValue: string
  ) => {
    const isEditing =
      editingCell?.entryId === entry.id && editingCell?.field === field;
    const formatted = field === "cedula" && displayValue ? `C.C. ${displayValue}` : displayValue;

    if (isEditing) {
      return (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          onBlur={commitEdit}
          autoFocus
          className="h-7 text-xs w-full min-w-[80px]"
        />
      );
    }

    if (!isAdmin) {
      return <span className="block truncate">{formatted || "—"}</span>;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            onClick={() => startEdit(entry.id, field, displayValue)}
            className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 block truncate"
          >
            {formatted || "—"}
          </span>
        </TooltipTrigger>
        {formatted && (
          <TooltipContent side="bottom" className="max-w-xs">
            {formatted}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  const renderStatusSelect = (entry: DirectoryEntry) => {
    const config = STATUS_CONFIG[entry.estado];

    if (!isAdmin) {
      return (
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            config.bg,
            config.text
          )}
        >
          {entry.estado}
        </span>
      );
    }

    return (
      <select
        value={entry.estado}
        onChange={(e) =>
          onUpdate(entry.id, { estado: e.target.value as DirectoryStatus })
        }
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring appearance-none",
          config.bg,
          config.text
        )}
      >
        {DIRECTORY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  };

  const colCount = isPersonType ? 7 : 6;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/30">
              {isPersonType ? (
                <>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Apellido</TableHead>
                  <TableHead className="w-[130px]">Cédula</TableHead>
                  <TableHead className="w-[130px]">Celular</TableHead>
                  <TableHead>Correo</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Razón Social</TableHead>
                  <TableHead className="w-[150px]">NIT</TableHead>
                  <TableHead className="w-[100px]">Margen %</TableHead>
                </>
              )}
              <TableHead className="w-[100px]">Estado</TableHead>
              {isAdmin && <TableHead className="w-[70px]" />}
            </TableRow>

            {isAdmin && (
              <TableRow className="bg-primary/5">
                {isPersonType ? (
                  <>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Nombre"
                        value={(newRow as typeof emptyPerson).nombre}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, nombre: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Apellido"
                        value={(newRow as typeof emptyPerson).apellido}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, apellido: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Cédula"
                        value={(newRow as typeof emptyPerson).cedula}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, cedula: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Celular"
                        value={(newRow as typeof emptyPerson).celular}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, celular: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Correo"
                        value={(newRow as typeof emptyPerson).correo}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, correo: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Empresa"
                        value={(newRow as typeof emptySupplier).empresa}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, empresa: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Razón Social"
                        value={(newRow as typeof emptySupplier).razonSocial}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, razonSocial: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="p-1">
                      <Input
                        placeholder="NIT"
                        value={(newRow as typeof emptySupplier).nit}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, nit: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Margen %"
                        type="number"
                        value={(newRow as typeof emptySupplier).margen}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, margen: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                  </>
                )}
                <TableHead className="p-1">
                  <select
                    value={newRow.estado}
                    onChange={(e) =>
                      setNewRow((r) => ({
                        ...r,
                        estado: e.target.value as DirectoryStatus,
                      }))
                    }
                    className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {DIRECTORY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </TableHead>
                <TableHead className="p-1" />
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center text-muted-foreground py-12"
                >
                  No hay registros.{" "}
                  {isAdmin && "Agrega uno desde la fila superior."}
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <TableRow key={entry.id} className="group">
                {isPerson(entry) ? (
                  <>
                    <TableCell className="text-sm font-medium">
                      {renderEditableCell(entry, "nombre", entry.nombre)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {renderEditableCell(entry, "apellido", entry.apellido)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {renderEditableCell(entry, "cedula", entry.cedula)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {renderEditableCell(entry, "celular", entry.celular)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {renderEditableCell(entry, "correo", entry.correo)}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-sm font-medium">
                      {renderEditableCell(entry, "empresa", entry.empresa)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {renderEditableCell(entry, "razonSocial", entry.razonSocial)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {renderEditableCell(entry, "nit", entry.nit)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {renderEditableCell(
                        entry,
                        "margen",
                        String(entry.margen)
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell>{renderStatusSelect(entry)}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          if (isPerson(entry)) {
                            startEdit(entry.id, "nombre", entry.nombre);
                          } else {
                            startEdit(entry.id, "empresa", entry.empresa);
                          }
                        }}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(entry.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registro</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este registro? Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
