import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCelesaOrders } from "./useCelesaOrders";
import { businessDaysSince } from "./types";
import { exportCelesaCSV } from "./csv-export";
import CelesaKpiCards from "./CelesaKpiCards";
import CelesaAlertBar from "./CelesaAlertBar";
import CelesaToolbar from "./CelesaToolbar";
import CelesaTable from "./CelesaTable";
import CelesaImportDialog from "./CelesaImportDialog";
import type { ParsedCelesaRow } from "./excel-import";
import type { CelesaOrder, CelesaStatus } from "./types";
import type { SortOption } from "./CelesaToolbar";

export default function CelesaTab() {
  const { orders, loading, addOrder, updateOrder, deleteOrder } =
    useCelesaOrders();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<CelesaStatus | "Todos">(
    "Todos"
  );
  const [sortBy, setSortBy] = useState<SortOption>("fecha-desc");
  const [importOpen, setImportOpen] = useState(false);

  const handleBulkImport = async (rows: ParsedCelesaRow[]) => {
    let count = 0;
    for (const row of rows) {
      await addOrder({ ...row, estado: "Pendiente" });
      count++;
    }
    toast.success(`${count} pedido${count !== 1 ? "s" : ""} importado${count !== 1 ? "s" : ""}`);
  };

  const filtered = useMemo(() => {
    let result = orders;

    if (filterStatus !== "Todos") {
      result = result.filter((o) => o.estado === filterStatus);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.numeroPedido.toLowerCase().includes(q) ||
          o.cliente.toLowerCase().includes(q) ||
          o.producto.toLowerCase().includes(q) ||
          (o.isbn || "").toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "fecha-asc":
          return a.fechaPedido.localeCompare(b.fechaPedido);
        case "fecha-desc":
          return b.fechaPedido.localeCompare(a.fechaPedido);
        case "cliente-az":
          return a.cliente.localeCompare(b.cliente);
        case "estado":
          return a.estado.localeCompare(b.estado);
        case "dias":
          return businessDaysSince(b.fechaPedido) - businessDaysSince(a.fechaPedido);
        default:
          return 0;
      }
    });

    return result;
  }, [orders, search, filterStatus, sortBy]);

  return (
    <div className="space-y-5">
      <CelesaKpiCards orders={orders} />
      <CelesaAlertBar orders={orders} />
      <CelesaToolbar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        sortBy={sortBy}
        onSortChange={setSortBy}
        count={filtered.length}
        onExport={() => exportCelesaCSV(filtered)}
        onImport={() => setImportOpen(true)}
      />
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <CelesaTable
        orders={filtered}
        onAdd={addOrder}
        onUpdate={updateOrder}
        onDelete={deleteOrder}
        onDuplicate={(order: CelesaOrder) => {
          addOrder({
            numeroPedido: order.numeroPedido,
            cliente: order.cliente,
            producto: order.producto,
            isbn: order.isbn,
            fechaPedido: order.fechaPedido,
            estado: "Pendiente",
          });
        }}
      />
      )}
      <CelesaImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleBulkImport}
      />
    </div>
  );
}
