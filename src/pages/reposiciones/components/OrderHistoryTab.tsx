import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrderHistory, useStatusTransition, useVendors, useDeleteOrder } from "../hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StringDatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, Search, Package } from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { toast } from "sonner";
import ExpandableOrderRow from "./ExpandableOrderRow";
import type { OrderHistoryFilters, OrderListItem } from "../types";

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  aprobado: {
    label: "Aprobado",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0",
  },
  enviado: {
    label: "Enviado",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-0",
  },
  parcial: {
    label: "Parcial",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0",
  },
  recibido: {
    label: "Recibido",
    className:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0",
  },
};

// ─── Transition map (per D-06) ────────────────────────────────────────────────

const TRANSITIONS: Record<string, { label: string; value: string }[]> = {
  aprobado: [{ label: "Marcar Enviado", value: "enviado" }],
  enviado: [
    { label: "Marcar Parcial", value: "parcial" },
    { label: "Marcar Recibido", value: "recibido" },
  ],
  parcial: [{ label: "Marcar Recibido", value: "recibido" }],
  recibido: [],
};

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortField = "created_at" | "vendor" | "status";

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderHistoryTab() {
  const { user } = useAuth();

  const [skuInput, setSkuInput] = useState("");
  const skuDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [filters, setFilters] = useState<OrderHistoryFilters>({
    vendor: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    sku: "",
  });

  // Debounce SKU search (300ms)
  useEffect(() => {
    clearTimeout(skuDebounceRef.current);
    skuDebounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, sku: skuInput.trim() }));
    }, 300);
    return () => clearTimeout(skuDebounceRef.current);
  }, [skuInput]);

  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const vendors = useVendors();
  const { orders, isLoading, error } = useOrderHistory(filters);
  const transitionMutation = useStatusTransition();
  const deleteMutation = useDeleteOrder();

  // ─── Sort toggle ────────────────────────────────────────────────────────────

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "created_at" ? "desc" : "asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  // ─── Client-side sort (after hook returns filtered orders) ──────────────────

  const sortedOrders = useMemo(() => {
    const sorted = [...orders];
    sorted.sort((a: OrderListItem, b: OrderListItem) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [orders, sortField, sortDir]);

  // ─── Transition handler ─────────────────────────────────────────────────────

  function handleTransition(orderId: string, newStatus: string) {
    if (!user?.uid) return;
    transitionMutation.mutate(
      { orderId, status: newStatus, changedBy: user.uid },
      {
        onSuccess: () =>
          toast.success(`Pedido marcado como ${newStatus}`),
      }
    );
  }

  // ─── Delete handler ─────────────────────────────────────────────────────────

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSettled: () => setDeleteId(null),
    });
  }

  // ─── Filter helpers ─────────────────────────────────────────────────────────

  function clearFilters() {
    setSkuInput("");
    setFilters({ vendor: "", status: "", dateFrom: "", dateTo: "", sku: "" });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* ISBN/SKU search */}
        <div className="flex flex-col gap-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">Buscar ISBN/SKU</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por ISBN/SKU..."
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              className="h-9 text-sm pl-8"
            />
          </div>
        </div>

        {/* Vendor filter */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs text-muted-foreground">Proveedor</span>
          <Select
            value={filters.vendor}
            onValueChange={(v) =>
              setFilters((prev) => ({ ...prev, vendor: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {(vendors.data ?? []).map((v) => (
                <SelectItem key={v.name} value={v.name}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1 min-w-[150px]">
          <span className="text-xs text-muted-foreground">Estado</span>
          <Select
            value={filters.status}
            onValueChange={(v) =>
              setFilters((prev) => ({ ...prev, status: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="aprobado">Aprobado</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="recibido">Recibido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Desde</span>
          <StringDatePicker
            value={filters.dateFrom}
            onChange={(val) =>
              setFilters((prev) => ({ ...prev, dateFrom: val }))
            }
            placeholder="Seleccionar"
            className="h-9 text-sm w-[160px]"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <StringDatePicker
            value={filters.dateTo}
            onChange={(val) =>
              setFilters((prev) => ({ ...prev, dateTo: val }))
            }
            placeholder="Seleccionar"
            className="h-9 text-sm w-[160px]"
          />
        </div>

        {/* Clear filters */}
        <Button variant="ghost" size="sm" className="h-9 self-end" onClick={clearFilters}>
          Limpiar filtros
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState compact message={`Error al cargar pedidos: ${error}`} />
      )}

      {/* Table */}
      <ScrollArea className="w-full rounded-md border">
        <div className="min-w-[700px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("vendor")}
                >
                  <span className="inline-flex items-center">
                    Proveedor <SortIcon field="vendor" />
                  </span>
                </TableHead>
                <TableHead>Sede</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("created_at")}
                >
                  <span className="inline-flex items-center">
                    Fecha Creacion <SortIcon field="created_at" />
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("status")}
                >
                  <span className="inline-flex items-center">
                    Estado <SortIcon field="status" />
                  </span>
                </TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Acciones</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <LoadingState message="Cargando pedidos..." />
                  </TableCell>
                </TableRow>
              ) : sortedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState compact icon={Package} title="No hay pedidos" />
                  </TableCell>
                </TableRow>
              ) : (
                sortedOrders.map((order) => (
                  <ExpandableOrderRow
                    key={order.order_id}
                    order={order}
                    statusBadge={
                      STATUS_BADGES[order.status] ?? {
                        label: order.status,
                        className: "border-0",
                      }
                    }
                    transitions={TRANSITIONS[order.status] ?? []}
                    onTransition={handleTransition}
                    isTransitioning={transitionMutation.isPending}
                    onDelete={(id) => setDeleteId(id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El pedido sera eliminado permanentemente del historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
