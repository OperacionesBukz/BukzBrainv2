import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectory } from "./useDirectory";
import { exportDirectory } from "./excel-utils";
import DirectoryToolbar from "./DirectoryToolbar";
import DirectoryTable from "./DirectoryTable";
import DirectoryImportDialog from "./DirectoryImportDialog";
import { TAB_LABELS, isPerson } from "./types";
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
    let result = entries.filter((e) => e.type === type);

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
            String(e.margen).includes(q)
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
    let count = 0;
    for (const row of rows) {
      await addEntry({
        type: "proveedor",
        empresa: row.empresa,
        razonSocial: row.razonSocial,
        nit: row.nit,
        margen: row.margen,
        estado: "Activo",
      });
      count++;
    }
    toast.success(
      `${count} registro${count !== 1 ? "s" : ""} importado${count !== 1 ? "s" : ""}`
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
      <DirectoryTable
        entries={filtered}
        type={type}
        onAdd={addEntry}
        onUpdate={updateEntry}
        onDelete={deleteEntry}
        isAdmin={isAdmin}
      />
      {isAdmin && (
        <DirectoryImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          type={type}
          onImportPersons={handleBulkImportPersons}
          onImportSuppliers={handleBulkImportSuppliers}
        />
      )}
    </div>
  );
}
