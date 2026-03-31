import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectory } from "./useDirectory";
import { exportDirectory } from "./excel-utils";
import DirectoryToolbar from "./DirectoryToolbar";
import DirectoryTable from "./DirectoryTable";
import DirectoryImportDialog from "./DirectoryImportDialog";
import { TAB_LABELS, isPerson, matchesTab } from "./types";
import type { DirectoryType, DirectoryStatus } from "./types";
import type { ParsedPersonRow, ParsedSupplierRow } from "./excel-utils";

interface DirectoryTabProps {
  type: DirectoryType;
  entries: ReturnType<typeof useDirectory>["entries"];
  loading: boolean;
  addEntry: ReturnType<typeof useDirectory>["addEntry"];
  updateEntry: ReturnType<typeof useDirectory>["updateEntry"];
  deleteEntry: ReturnType<typeof useDirectory>["deleteEntry"];
}

export default function DirectoryTab({
  type,
  entries,
  loading,
  addEntry,
  updateEntry,
  deleteEntry,
}: DirectoryTabProps) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<DirectoryStatus | "Todos">(
    "Todos"
  );
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = type === "proveedor"
      ? entries.filter((e) => e.type === "proveedor")
      : entries.filter((e) => isPerson(e) && matchesTab(e, type));

    if (filterStatus !== "Todos") {
      result = result.filter((e) => e.estado === filterStatus);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        if (isPerson(e)) {
          return (
            e.nombre.toLowerCase().includes(q) ||
            e.apellido.toLowerCase().includes(q) ||
            e.cedula.toLowerCase().includes(q) ||
            e.celular.toLowerCase().includes(q) ||
            e.correo.toLowerCase().includes(q)
          );
        } else {
          return (
            e.empresa.toLowerCase().includes(q) ||
            e.razonSocial.toLowerCase().includes(q) ||
            e.nit.toLowerCase().includes(q) ||
            String(e.margen).includes(q) ||
            (e.correo || "").toLowerCase().includes(q)
          );
        }
      });
    }

    return result;
  }, [entries, type, search, filterStatus]);

  const handleBulkImportPersons = async (rows: ParsedPersonRow[]) => {
    let count = 0;
    for (const row of rows) {
      await addEntry({
        type,
        nombre: row.nombre,
        apellido: row.apellido,
        cedula: row.cedula,
        celular: row.celular,
        correo: row.correo,
        estado: "Activo",
      });
      count++;
    }
    toast.success(
      `${count} registro${count !== 1 ? "s" : ""} importado${count !== 1 ? "s" : ""}`
    );
  };

  const handleBulkImportSuppliers = async (rows: ParsedSupplierRow[]) => {
    // Build a lookup of existing suppliers by normalized empresa name
    const existingSuppliers = entries.filter((e) => e.type === "proveedor");
    const supplierMap = new Map<string, typeof existingSuppliers[0]>();
    for (const s of existingSuppliers) {
      if ("empresa" in s) {
        supplierMap.set(s.empresa.trim().toLowerCase(), s);
      }
    }

    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const key = row.empresa.trim().toLowerCase();
      const existing = supplierMap.get(key);
      if (existing) {
        // Update only fields that have values in the import
        const updates: Record<string, unknown> = {};
        if (row.margen != null) updates.margen = row.margen;
        if (row.razonSocial) updates.razonSocial = row.razonSocial;
        if (row.nit) updates.nit = row.nit;
        if (row.correo) updates.correo = row.correo;
        if (row.correos_cc?.length) updates.correos_cc = row.correos_cc;
        if (row.observaciones) updates.observaciones = row.observaciones;
        if (row.contactos?.length) updates.contactos = row.contactos;
        if (Object.keys(updates).length > 0) {
          await updateEntry(existing.id, updates);
          updated++;
        }
      } else {
        await addEntry({
          type: "proveedor",
          empresa: row.empresa,
          razonSocial: row.razonSocial,
          nit: row.nit,
          margen: row.margen,
          correo: row.correo,
          correos_cc: row.correos_cc || [],
          observaciones: row.observaciones || "",
          contactos: row.contactos || [],
          estado: "Activo",
        });
        created++;
      }
    }
    const parts: string[] = [];
    if (updated > 0) parts.push(`${updated} actualizado${updated !== 1 ? "s" : ""}`);
    if (created > 0) parts.push(`${created} creado${created !== 1 ? "s" : ""}`);
    toast.success(parts.join(", ") || "Sin cambios");
  };

  return (
    <div className="space-y-5">
      <DirectoryToolbar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        count={filtered.length}
        onExport={() => exportDirectory(filtered, type)}
        onImport={() => setImportOpen(true)}
        isAdmin={isAdmin}
        entityLabel={TAB_LABELS[type]}
      />
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <DirectoryTable
        entries={filtered}
        type={type}
        onAdd={addEntry}
        onUpdate={updateEntry}
        onDelete={deleteEntry}
        isAdmin={isAdmin}
      />
      )}
      {isAdmin && (
        <DirectoryImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          type={type}
          existingEntries={entries}
          onImportPersons={handleBulkImportPersons}
          onImportSuppliers={handleBulkImportSuppliers}
        />
      )}
    </div>
  );
}
