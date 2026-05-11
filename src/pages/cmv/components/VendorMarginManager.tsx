import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { parseMarginsExcel, type MarginImportRow } from "../excel-utils";
import type { Vendor, VendorFormData } from "../types";

interface VendorMarginManagerProps {
  vendors: Vendor[];
  loading: boolean;
  onAdd: (data: VendorFormData) => Promise<void>;
  onUpdate: (id: string, data: VendorFormData) => Promise<void>;
  onRemove: (id: string, name: string) => Promise<void>;
  onImport: (rows: VendorFormData[]) => Promise<void>;
}

export function VendorMarginManager({
  vendors,
  loading,
  onAdd,
  onUpdate,
  onRemove,
  onImport,
}: VendorMarginManagerProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMargin, setEditMargin] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMargin, setNewMargin] = useState("");
  const [saving, setSaving] = useState(false);

  // Importación
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<MarginImportRow[] | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Filtrar vendors
  const filtered = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(q));
  }, [vendors, search]);

  // --- Agregar ---
  async function handleAdd() {
    const name = newName.trim();
    const margin = parseFloat(newMargin);
    if (!name) {
      toast.error("El nombre del vendor es requerido");
      return;
    }
    if (isNaN(margin) || margin <= 0 || margin > 100) {
      toast.error("El margen debe ser un porcentaje entre 0 y 100");
      return;
    }
    setSaving(true);
    try {
      await onAdd({ name, margin: margin / 100 });
      setNewName("");
      setNewMargin("");
      setIsAdding(false);
    } catch {
      toast.error("Error al agregar vendor");
    } finally {
      setSaving(false);
    }
  }

  // --- Editar ---
  function startEdit(vendor: Vendor) {
    setEditingId(vendor.id);
    setEditName(vendor.name);
    setEditMargin(String((vendor.margin * 100).toFixed(1)));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditMargin("");
  }

  async function handleSaveEdit(id: string) {
    const name = editName.trim();
    const margin = parseFloat(editMargin);
    if (!name) {
      toast.error("El nombre del vendor es requerido");
      return;
    }
    if (isNaN(margin) || margin <= 0 || margin > 100) {
      toast.error("El margen debe ser un porcentaje entre 0 y 100");
      return;
    }
    setSaving(true);
    try {
      await onUpdate(id, { name, margin: margin / 100 });
      setEditingId(null);
    } catch {
      toast.error("Error al actualizar vendor");
    } finally {
      setSaving(false);
    }
  }

  // --- Importar ---
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const rows = parseMarginsExcel(buffer);
        if (rows.length === 0) {
          toast.error("No se encontraron registros válidos en el archivo");
          return;
        }
        setImportPreview(rows);
        setImportDialogOpen(true);
      } catch {
        toast.error("Error al leer el archivo de márgenes");
      }
    };
    reader.readAsArrayBuffer(file);
    // Limpiar el input para permitir seleccionar el mismo archivo
    e.target.value = "";
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      await onImport(
        importPreview.map((r) => ({ name: r.vendor, margin: r.margin }))
      );
      setImportDialogOpen(false);
      setImportPreview(null);
    } catch {
      toast.error("Error al importar márgenes");
    } finally {
      setImporting(false);
    }
  }

  // --- Skeleton de carga ---
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra superior: búsqueda + acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar Vendor
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          Importar Márgenes
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Contador */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} de {vendors.length} vendors
      </p>

      {/* Tabla */}
      <ScrollArea className="rounded-md border max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre del Vendor</TableHead>
              <TableHead className="text-right w-[120px]">Margen (%)</TableHead>
              <TableHead className="text-right w-[120px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Fila de agregar nuevo */}
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Input
                    placeholder="Nombre del vendor"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    placeholder="Ej: 40"
                    value={newMargin}
                    onChange={(e) => setNewMargin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="text-right"
                    min={0}
                    max={100}
                    step={0.1}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleAdd}
                      disabled={saving}
                      title="Guardar"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setIsAdding(false);
                        setNewName("");
                        setNewMargin("");
                      }}
                      title="Cancelar"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Filas de vendors */}
            {filtered.length === 0 && !isAdding ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  {search ? "No se encontraron vendors" : "No hay vendors registrados"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((vendor) =>
                editingId === vendor.id ? (
                  // Fila en modo edición
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(vendor.id)}
                        autoFocus
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editMargin}
                        onChange={(e) => setEditMargin(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(vendor.id)}
                        className="text-right"
                        min={0}
                        max={100}
                        step={0.1}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSaveEdit(vendor.id)}
                          disabled={saving}
                          title="Guardar"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEdit}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  // Fila en modo lectura
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="text-right">
                      {(vendor.margin * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(vendor)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title="Eliminar">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar vendor</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro de eliminar a <strong>{vendor.name}</strong>?
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onRemove(vendor.id, vendor.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Dialog de previsualización de importación */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Previsualización de Importación
            </DialogTitle>
          </DialogHeader>
          {importPreview && (
            <>
              <p className="text-sm text-muted-foreground">
                Se importarán <strong>{importPreview.length}</strong> vendors con sus márgenes.
              </p>
              <ScrollArea className="max-h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Margen (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.vendor}</TableCell>
                        <TableCell className="text-right">
                          {(row.margin * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportPreview(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmImport} disabled={importing}>
              {importing ? "Importando..." : "Confirmar Importación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
