import { useState, useRef, useMemo, useCallback, Fragment } from "react";
import { Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, ChevronDown, Plus, X, Phone, Mail } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
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
  PersonEntry,
  SupplierEntry,
  ContactoComercial,
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
type SupplierField = "empresa" | "razonSocial" | "nit" | "margen" | "correo" | "observaciones";
type EditableField = PersonField | SupplierField;

type SortKey = "nombre" | "cedula" | "celular" | "correo" | "tipo" | "estado"
  | "empresa" | "razonSocial" | "nit" | "margen" | "observaciones";
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
  observaciones: "",
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
  const isMobile = useIsMobile();
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
  const [showMobileNewForm, setShowMobileNewForm] = useState(false);

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
        observaciones: s.observaciones.trim(),
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
    displayValue: string,
    formattedOverride?: string
  ) => {
    const isEditing =
      editingCell?.entryId === entry.id && editingCell?.field === field;
    const formatted = formattedOverride ?? (field === "cedula" && displayValue ? `C.C. ${displayValue}` : displayValue);

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

  // ── Contactos comerciales state ──
  const [newContacto, setNewContacto] = useState<ContactoComercial>({ nombre: "", correo: "", ciudad: "" });

  const handleAddContacto = async (entry: SupplierEntry) => {
    if (!newContacto.nombre.trim() && !newContacto.correo.trim()) return;
    const contactos = [...(entry.contactos || []), { ...newContacto }];
    await onUpdate(entry.id, { contactos });
    setNewContacto({ nombre: "", correo: "", ciudad: "" });
  };

  const handleRemoveContacto = async (entry: SupplierEntry, index: number) => {
    const contactos = (entry.contactos || []).filter((_, i) => i !== index);
    await onUpdate(entry.id, { contactos });
  };

  const colCount = isPersonType ? 8 : 9;

  // ── Mobile rendering functions ──

  const renderMobileEditableField = (
    entry: DirectoryEntry,
    field: EditableField,
    displayValue: string,
    formattedOverride?: string,
    className?: string
  ) => {
    const isEditing =
      editingCell?.entryId === entry.id && editingCell?.field === field;
    const formatted = formattedOverride ?? displayValue;

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
          className="h-8 text-sm w-full"
        />
      );
    }

    if (!isAdmin) {
      return <span className={cn("block", className)}>{formatted || "\u2014"}</span>;
    }

    return (
      <span
        onClick={(e) => { e.stopPropagation(); startEdit(entry.id, field, displayValue); }}
        className={cn("block cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1", className)}
      >
        {formatted || "\u2014"}
      </span>
    );
  };

  const renderMobilePersonCard = (entry: DirectoryEntry & { nombre: string; apellido: string; cedula: string; celular: string; correo: string }) => {
    const isExpanded = expandedId === entry.id;
    const isInactive = entry.estado === "Inactivo";
    const clasificacion = getClasificacion(entry as PersonEntry);
    const clasConfig = CLASIFICACION_CONFIG[clasificacion];

    return (
      <div key={entry.id} className={cn("rounded-lg border bg-card", isInactive && "opacity-50")}>
        <div
          className="p-3 space-y-1.5 cursor-pointer active:bg-muted/30 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        >
          {/* Top row: clasificacion + estado badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isAdmin ? renderClasificacionSelect(entry) : (
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", clasConfig.bg, clasConfig.text)}>
                  {clasificacion}
                </span>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              {renderStatusSelect(entry)}
            </div>
          </div>

          {/* Name */}
          <div className={cn("font-medium text-sm", isInactive && "line-through")} onClick={(e) => isAdmin && e.stopPropagation()}>
            {renderMobileEditableField(entry, "nombre", `${entry.nombre} ${entry.apellido}`.trim(), undefined, "font-medium")}
          </div>

          {/* Cedula + Celular */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span onClick={(e) => isAdmin && e.stopPropagation()} className="inline-flex items-center gap-1">
              {renderMobileEditableField(entry, "cedula", entry.cedula, entry.cedula ? `C.C. ${entry.cedula}` : "\u2014", "text-xs")}
            </span>
            {entry.celular && (
              <>
                <span className="text-muted-foreground/40">&middot;</span>
                <span onClick={(e) => isAdmin && e.stopPropagation()} className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {renderMobileEditableField(entry, "celular", entry.celular, undefined, "text-xs")}
                </span>
              </>
            )}
          </div>

          {/* Correo */}
          {entry.correo && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" onClick={(e) => isAdmin && e.stopPropagation()}>
              <Mail className="h-3 w-3 shrink-0" />
              {renderMobileEditableField(entry, "correo", entry.correo, undefined, "text-xs truncate")}
            </div>
          )}
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs gap-1.5 flex-1"
              onClick={() => startEdit(entry.id, "nombre", `${entry.nombre} ${entry.apellido}`.trim())}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs gap-1.5 flex-1 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(entry.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </div>
        )}

        {/* Expanded section */}
        {isExpanded && (
          <div className="border-t">
            <EmployeeLeaveHistory cedula={entry.cedula} />
          </div>
        )}
      </div>
    );
  };

  const renderMobileSupplierCard = (entry: SupplierEntry) => {
    const isExpanded = expandedId === entry.id;
    const isInactive = entry.estado === "Inactivo";

    return (
      <div key={entry.id} className={cn("rounded-lg border bg-card", isInactive && "opacity-50")}>
        <div
          className="p-3 space-y-1.5 cursor-pointer active:bg-muted/30 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        >
          {/* Top row: estado + margen */}
          <div className="flex items-center justify-between gap-2">
            <div onClick={(e) => e.stopPropagation()}>
              {renderStatusSelect(entry)}
            </div>
            {entry.margen != null && (
              <span onClick={(e) => isAdmin && e.stopPropagation()}>
                {renderMobileEditableField(entry, "margen", String(entry.margen), `${entry.margen}%`, "text-sm font-semibold tabular-nums")}
              </span>
            )}
          </div>

          {/* Empresa */}
          <div className={cn("font-medium text-sm", isInactive && "line-through")} onClick={(e) => isAdmin && e.stopPropagation()}>
            {renderMobileEditableField(entry, "empresa", entry.empresa, undefined, "font-medium")}
          </div>

          {/* RazonSocial + NIT */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span onClick={(e) => isAdmin && e.stopPropagation()}>
              {renderMobileEditableField(entry, "razonSocial", entry.razonSocial, undefined, "text-xs")}
            </span>
            {entry.nit && (
              <>
                <span className="text-muted-foreground/40">&middot;</span>
                <span onClick={(e) => isAdmin && e.stopPropagation()}>
                  {renderMobileEditableField(entry, "nit", entry.nit, `NIT ${entry.nit}`, "text-xs")}
                </span>
              </>
            )}
          </div>

          {/* Correo */}
          {entry.correo && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" onClick={(e) => isAdmin && e.stopPropagation()}>
              <Mail className="h-3 w-3 shrink-0" />
              {renderMobileEditableField(entry, "correo", entry.correo, undefined, "text-xs truncate")}
            </div>
          )}

          {/* Observaciones */}
          {entry.observaciones && (
            <div className={cn("text-xs text-muted-foreground", entry.observaciones.toLowerCase() !== "automatico" && "font-bold")} onClick={(e) => isAdmin && e.stopPropagation()}>
              {renderMobileEditableField(entry, "observaciones", entry.observaciones, `Obs: ${entry.observaciones}`, "text-xs")}
            </div>
          )}
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs gap-1.5 flex-1"
              onClick={() => startEdit(entry.id, "empresa", entry.empresa)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs gap-1.5 flex-1 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(entry.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </div>
        )}

        {/* Expanded: contactos comerciales */}
        {isExpanded && (
          <div className="border-t px-3 py-3 space-y-2">
            <h4 className="text-sm font-medium">Contactos Comerciales</h4>
            <p className="text-xs text-muted-foreground">
              Se usan para pedidos y devoluciones. El correo principal se usa para cortes.
            </p>
            {(entry.contactos?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {entry.contactos!.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm bg-background rounded p-2 border">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="font-medium text-xs">{c.nombre || "\u2014"}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.correo}</p>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded inline-block">{c.ciudad || "General"}</span>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleRemoveContacto(entry, i); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <div className="space-y-2 pt-1">
                <Input
                  placeholder="Nombre"
                  value={newContacto.nombre}
                  onChange={(e) => setNewContacto((c) => ({ ...c, nombre: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContacto(entry)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Correo"
                  value={newContacto.correo}
                  onChange={(e) => setNewContacto((c) => ({ ...c, correo: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContacto(entry)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Ciudad"
                  value={newContacto.ciudad}
                  onChange={(e) => setNewContacto((c) => ({ ...c, ciudad: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContacto(entry)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs w-full"
                  onClick={(e) => { e.stopPropagation(); handleAddContacto(entry); }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar contacto
                </Button>
              </div>
            )}
            {!isAdmin && (entry.contactos?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin contactos comerciales</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMobileNewForm = () => {
    if (!isAdmin) return null;

    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 gap-2"
          onClick={() => setShowMobileNewForm((v) => !v)}
        >
          {showMobileNewForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showMobileNewForm ? "Cancelar" : "Agregar registro"}
        </Button>
        {showMobileNewForm && (
          <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
            {isPersonType ? (
              <>
                <Input
                  placeholder="Nombre completo"
                  value={(newRow as typeof emptyPerson).nombreCompleto}
                  onChange={(e) => setNewRow((r) => ({ ...r, nombreCompleto: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="C\u00e9dula"
                  value={(newRow as typeof emptyPerson).cedula}
                  onChange={(e) => setNewRow((r) => ({ ...r, cedula: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Celular"
                  value={(newRow as typeof emptyPerson).celular}
                  onChange={(e) => setNewRow((r) => ({ ...r, celular: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Correo"
                  value={(newRow as typeof emptyPerson).correo}
                  onChange={(e) => setNewRow((r) => ({ ...r, correo: e.target.value }))}
                  className="h-9 text-sm"
                />
                <select
                  value={(newRow as typeof emptyPerson).clasificacion}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, clasificacion: e.target.value as PersonClasificacion }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">
                    {type === "empleado" ? "Empleado" : "Temporal"}
                  </option>
                  {PERSON_CLASIFICACIONES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <Input
                  placeholder="Empresa"
                  value={(newRow as typeof emptySupplier).empresa}
                  onChange={(e) => setNewRow((r) => ({ ...r, empresa: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Raz\u00f3n Social"
                  value={(newRow as typeof emptySupplier).razonSocial}
                  onChange={(e) => setNewRow((r) => ({ ...r, razonSocial: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="NIT"
                  value={(newRow as typeof emptySupplier).nit}
                  onChange={(e) => setNewRow((r) => ({ ...r, nit: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Margen %"
                  type="number"
                  value={(newRow as typeof emptySupplier).margen}
                  onChange={(e) => setNewRow((r) => ({ ...r, margen: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Correo"
                  value={(newRow as typeof emptySupplier).correo}
                  onChange={(e) => setNewRow((r) => ({ ...r, correo: e.target.value }))}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Observaciones"
                  value={(newRow as typeof emptySupplier).observaciones}
                  onChange={(e) => setNewRow((r) => ({ ...r, observaciones: e.target.value }))}
                  className="h-9 text-sm"
                />
              </>
            )}
            <select
              value={newRow.estado}
              onChange={(e) =>
                setNewRow((r) => ({ ...r, estado: e.target.value as DirectoryStatus }))
              }
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DIRECTORY_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button
              className="w-full h-9"
              onClick={async () => {
                await handleAddRow();
                setShowMobileNewForm(false);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderMobileView = () => (
    <div className="space-y-3">
      {renderMobileNewForm()}
      {sortedEntries.length === 0 && (
        <div className="text-center text-muted-foreground py-12 border rounded-lg">
          No hay registros.{" "}
          {isAdmin && "Agrega uno con el bot\u00f3n superior."}
        </div>
      )}
      {sortedEntries.map((entry) =>
        isPerson(entry)
          ? renderMobilePersonCard(entry)
          : renderMobileSupplierCard(entry as SupplierEntry)
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {renderMobileView()}
        <AlertDialog
          open={deleteId !== null}
          onOpenChange={(open) => !open && setDeleteId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar registro</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Est\u00e1s seguro de que deseas eliminar este registro? Esta acci\u00f3n no
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
      </>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-lg border">
        <Table className={!isPersonType ? "table-fixed w-full" : undefined}>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[40px]" />
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
                  <SortableHead label="Empresa" sortField="empresa" className="w-[16%]" />
                  <SortableHead label="Razón Social" sortField="razonSocial" className="w-[16%] whitespace-nowrap" />
                  <SortableHead label="NIT" sortField="nit" className="w-[10%]" />
                  <SortableHead label="Margen %" sortField="margen" className="w-[7%]" />
                  <SortableHead label="Correo" sortField="correo" className="w-[18%]" />
                  <SortableHead label="Observaciones" sortField="observaciones" className="w-[18%]" />
                </>
              )}
              <SortableHead label="Estado" sortField="estado" className={isPersonType ? "w-[100px]" : "w-[8%]"} />
              {isAdmin && <TableHead className={isPersonType ? "w-[70px]" : "w-[5%]"} />}
            </TableRow>

            {isAdmin && (
              <TableRow className="bg-primary/5">
                <TableHead className="p-1" />
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
                    <TableHead className="p-1">
                      <Input
                        placeholder="Observaciones"
                        value={(newRow as typeof emptySupplier).observaciones}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, observaciones: e.target.value }))
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
                      "group cursor-pointer hover:bg-muted/30",
                      isInactive && "opacity-50"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <TableCell className="w-[40px] px-2">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </TableCell>
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
                        <TableCell className={cn("text-sm font-medium", isInactive && "line-through")} onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "empresa", entry.empresa)}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "razonSocial", entry.razonSocial)}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "nit", entry.nit)}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(
                            entry,
                            "margen",
                            String(entry.margen),
                            entry.margen != null ? `${entry.margen}%` : "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "correo", entry.correo || "")}
                        </TableCell>
                        <TableCell className={cn("text-sm", entry.observaciones && entry.observaciones.toLowerCase() !== "automatico" && "font-bold")} onClick={(e) => isAdmin && e.stopPropagation()}>
                          {renderEditableCell(entry, "observaciones", entry.observaciones || "")}
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
                  {!personEntry && isExpanded && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={isAdmin ? colCount : colCount - 1} className="p-0">
                        <div className="px-6 py-3">
                          <h4 className="text-sm font-medium mb-2">Contactos Comerciales</h4>
                          <p className="text-xs text-muted-foreground mb-3">
                            Se usan para pedidos y devoluciones. El correo principal se usa para cortes.
                          </p>
                          {(entry.contactos?.length ?? 0) > 0 && (
                            <div className="space-y-1 mb-3">
                              {entry.contactos!.map((c, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm bg-background rounded px-3 py-1.5 border">
                                  <span className="font-medium min-w-[120px]">{c.nombre || "—"}</span>
                                  <span className="text-muted-foreground min-w-[200px]">{c.correo}</span>
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded">{c.ciudad || "General"}</span>
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 ml-auto text-destructive hover:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); handleRemoveContacto(entry, i); }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder="Nombre"
                                value={newContacto.nombre}
                                onChange={(e) => setNewContacto((c) => ({ ...c, nombre: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleAddContacto(entry)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-xs w-[150px]"
                              />
                              <Input
                                placeholder="Correo"
                                value={newContacto.correo}
                                onChange={(e) => setNewContacto((c) => ({ ...c, correo: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleAddContacto(entry)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-xs w-[200px]"
                              />
                              <Input
                                placeholder="Ciudad"
                                value={newContacto.ciudad}
                                onChange={(e) => setNewContacto((c) => ({ ...c, ciudad: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleAddContacto(entry)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-xs w-[120px]"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => { e.stopPropagation(); handleAddContacto(entry); }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Agregar
                              </Button>
                            </div>
                          )}
                          {!isAdmin && (entry.contactos?.length ?? 0) === 0 && (
                            <p className="text-xs text-muted-foreground italic">Sin contactos comerciales</p>
                          )}
                        </div>
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
