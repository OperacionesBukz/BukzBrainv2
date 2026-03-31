import { useState, useRef, useMemo, useCallback, Fragment } from "react";
import { Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, ChevronDown } from "lucide-react";
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
import EmployeeLeaveHistory from "./EmployeeLeaveHistory";
import {
  STATUS_CONFIG,
  DIRECTORY_STATUSES,
  CLASIFICACION_CONFIG,
  PERSON_CLASIFICACIONES,
  isPerson,
  getClasificacion,
} from "./types";
import type {
  DirectoryEntry,
  DirectoryType,
  DirectoryStatus,
  PersonClasificacion,
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
  ) => Promise<boolean | void>;
  onDelete: (id: string) => Promise<void>;
  isAdmin: boolean;
}

type PersonField = "nombre" | "cedula" | "celular" | "correo";
type SupplierField = "empresa" | "razonSocial" | "nit" | "margen" | "correo";
type EditableField = PersonField | SupplierField;

type SortKey = "nombre" | "cedula" | "celular" | "correo" | "tipo" | "estado"
  | "empresa" | "razonSocial" | "nit" | "margen";
type SortDir = "asc" | "desc";

interface EditingCell {
  entryId: string;
  field: EditableField;
}

const emptyPerson = {
  nombreCompleto: "",
  cedula: "",
  celular: "",
  correo: "",
  clasificacion: "" as PersonClasificacion | "",
  estado: "Activo" as DirectoryStatus,
};

const emptySupplier = {
  empresa: "",
  razonSocial: "",
  nit: "",
  margen: "",
  correo: "",
  correos_cc: "",
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const sortedEntries = useMemo(() => {
    if (!sortKey) return entries;
    return [...entries].sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortKey === "nombre" && isPerson(a) && isPerson(b)) {
        valA = `${a.nombre} ${a.apellido}`.toLowerCase();
        valB = `${b.nombre} ${b.apellido}`.toLowerCase();
      } else if (sortKey === "tipo" && isPerson(a) && isPerson(b)) {
        valA = getClasificacion(a);
        valB = getClasificacion(b);
      } else if (sortKey === "margen") {
        const nA = (a as SupplierEntry).margen ?? 0;
        const nB = (b as SupplierEntry).margen ?? 0;
        return sortDir === "asc" ? nA - nB : nB - nA;
      } else {
        valA = String((a as Record<string, unknown>)[sortKey] ?? "").toLowerCase();
        valB = String((b as Record<string, unknown>)[sortKey] ?? "").toLowerCase();
      }
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [entries, sortKey, sortDir]);

  const SortableHead = ({ label, sortField, className }: { label: string; sortField: SortKey; className?: string }) => (
    <TableHead
      className={cn("group/sort cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
      onClick={() => toggleSort(sortField)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortField ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover/sort:opacity-30 transition-opacity" />
        )}
      </span>
    </TableHead>
  );

  const splitFullName = (full: string) => {
    const parts = full.trim().split(/\s+/);
    if (parts.length <= 1) return { nombre: parts[0] || "", apellido: "" };
    const mid = Math.ceil(parts.length / 2);
    return { nombre: parts.slice(0, mid).join(" "), apellido: parts.slice(mid).join(" ") };
  };

  const handleAddRow = async () => {
    if (isPersonType) {
      const p = newRow as typeof emptyPerson;
      if (!p.nombreCompleto.trim()) return;
      const { nombre, apellido } = splitFullName(p.nombreCompleto);
      const clasificacion: PersonClasificacion = p.clasificacion || (type === "empleado" ? "Empleado" : "Temporal");
      const derivedType = clasificacion === "Temporal" ? "temporal" : "empleado";
      await onAdd({
        type: derivedType,
        nombre,
        apellido,
        cedula: p.cedula.trim(),
        celular: p.celular.trim(),
        correo: p.correo.trim(),
        clasificacion,
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
        correo: s.correo.trim(),
        correos_cc: (s.correos_cc || "")
          .split(";")
          .map((v: string) => v.trim())
          .filter(Boolean),
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

    // For "nombre" field on persons, we edit the full name and split back
    if (editingCell.field === "nombre" && isPerson(entry)) {
      const currentFull = `${entry.nombre} ${entry.apellido}`.trim();
      if (editValue.trim() === currentFull) {
        setEditingCell(null);
        return;
      }
      const { nombre, apellido } = splitFullName(editValue);
      await onUpdate(editingCell.entryId, { nombre, apellido });
      setEditingCell(null);
      return;
    }

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
          <option key={s} value={s} className="bg-popover text-popover-foreground">
            {s}
          </option>
        ))}
      </select>
    );
  };

  const renderClasificacionSelect = (entry: DirectoryEntry) => {
    if (!isPerson(entry)) return null;
    const clasificacion = getClasificacion(entry);
    const config = CLASIFICACION_CONFIG[clasificacion];

    if (!isAdmin) {
      return (
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
            config.bg,
            config.text
          )}
        >
          {clasificacion}
        </span>
      );
    }

    return (
      <select
        value={clasificacion}
        onChange={(e) => {
          const newClasificacion = e.target.value as PersonClasificacion;
          const newType = newClasificacion === "Temporal" ? "temporal" : "empleado";
          onUpdate(entry.id, {
            clasificacion: newClasificacion,
            type: newType,
          });
        }}
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring appearance-none",
          config.bg,
          config.text
        )}
      >
        {PERSON_CLASIFICACIONES.map((c) => (
          <option key={c} value={c} className="bg-popover text-popover-foreground">
            {c}
          </option>
        ))}
      </select>
    );
  };

  const colCount = isPersonType ? 8 : 7;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {isPersonType && <TableHead className="w-[40px]" />}
              {isPersonType ? (
                <>
                  <SortableHead label="Nombre" sortField="nombre" />
                  <SortableHead label="Cédula" sortField="cedula" className="w-auto whitespace-nowrap" />
                  <SortableHead label="Celular" sortField="celular" className="w-[130px]" />
                  <SortableHead label="Correo" sortField="correo" />
                  <SortableHead label="Tipo" sortField="tipo" className="w-[150px]" />
                </>
              ) : (
                <>
                  <SortableHead label="Empresa" sortField="empresa" />
                  <SortableHead label="Razón Social" sortField="razonSocial" />
                  <SortableHead label="NIT" sortField="nit" className="w-[150px]" />
                  <SortableHead label="Margen %" sortField="margen" className="w-[100px]" />
                  <SortableHead label="Correo" sortField="correo" />
                </>
              )}
              <SortableHead label="Estado" sortField="estado" className="w-[100px]" />
              {isAdmin && <TableHead className="w-[70px]" />}
            </TableRow>

            {isAdmin && (
              <TableRow className="bg-primary/5">
                {isPersonType && <TableHead className="p-1" />}
                {isPersonType ? (
                  <>
                    <TableHead className="p-1">
                      <Input
                        placeholder="Nombre completo"
                        value={(newRow as typeof emptyPerson).nombreCompleto}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, nombreCompleto: e.target.value }))
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
                    <TableHead className="p-1">
                      <select
                        value={(newRow as typeof emptyPerson).clasificacion}
                        onChange={(e) =>
                          setNewRow((r) => ({
                            ...r,
                            clasificacion: e.target.value as PersonClasificacion,
                          }))
                        }
                        className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">
                          {type === "empleado" ? "Empleado" : "Temporal"}
                        </option>
                        {PERSON_CLASIFICACIONES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
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
                    <TableHead className="p-1">
                      <Input
                        placeholder="Correo"
                        value={(newRow as typeof emptySupplier).correo}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, correo: e.target.value }))
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
            {sortedEntries.length === 0 && (
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
            {sortedEntries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const personEntry = isPerson(entry);

              const isInactive = entry.estado === "Inactivo";

              return (
                <Fragment key={entry.id}>
                  <TableRow
                    className={cn(
                      "group",
                      personEntry && "cursor-pointer hover:bg-muted/30",
                      isInactive && "opacity-50"
                    )}
                    onClick={personEntry ? () => setExpandedId(isExpanded ? null : entry.id) : undefined}
                  >
                    {personEntry && (
                      <TableCell className="w-[40px] px-2">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>
                    )}
                    {personEntry ? (
                      <>
                        <TableCell className={cn("text-sm font-medium", isInactive && "line-through")} onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "nombre", `${entry.nombre} ${entry.apellido}`.trim())}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "cedula", entry.cedula)}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "celular", entry.celular)}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "correo", entry.correo)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>{renderClasificacionSelect(entry)}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className={cn("text-sm font-medium", isInactive && "line-through")}>
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
                        <TableCell className="text-sm">
                          {renderEditableCell(entry, "correo", entry.correo || "")}
                        </TableCell>
                      </>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>{renderStatusSelect(entry)}</TableCell>
                    {isAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                  {personEntry && isExpanded && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={isAdmin ? colCount : colCount - 1} className="p-0">
                        <EmployeeLeaveHistory cedula={entry.cedula} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
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
