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
import { cn } from "@/lib/utils";
import {
  CELESA_STATUS_CONFIG,
  CELESA_STATUSES,
  businessDaysSince,
} from "./types";
import type { CelesaOrder, CelesaStatus } from "./types";

interface CelesaTableProps {
  orders: CelesaOrder[];
  onAdd: (data: {
    numeroPedido: string;
    cliente: string;
    producto: string;
    isbn: string;
    fechaPedido: string;
    estado: CelesaStatus;
  }) => Promise<void>;
  onUpdate: (
    id: string,
    updates: Partial<Omit<CelesaOrder, "id" | "createdAt" | "createdBy">>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface EditingCell {
  orderId: string;
  field: keyof Pick<CelesaOrder, "numeroPedido" | "cliente" | "producto" | "isbn" | "fechaPedido">;
}

const emptyNew = {
  numeroPedido: "",
  cliente: "",
  producto: "",
  isbn: "",
  fechaPedido: new Date().toISOString().slice(0, 10),
  estado: "Pendiente" as CelesaStatus,
};

export default function CelesaTable({
  orders,
  onAdd,
  onUpdate,
  onDelete,
}: CelesaTableProps) {
  const [newRow, setNewRow] = useState({ ...emptyNew });
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddRow = async () => {
    if (!newRow.numeroPedido.trim() || !newRow.cliente.trim()) return;
    await onAdd(newRow);
    setNewRow({ ...emptyNew });
  };

  const startEdit = (
    orderId: string,
    field: EditingCell["field"],
    currentValue: string
  ) => {
    setEditingCell({ orderId, field });
    setEditValue(currentValue);
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const currentValue = getFieldValue(editingCell.orderId, editingCell.field);
    if (editValue === currentValue) {
      setEditingCell(null);
      return;
    }

    const updates: Record<string, string> = { [editingCell.field]: editValue };

    // Si se cambió la fecha, verificar si debe marcarse como Atrasado
    if (editingCell.field === "fechaPedido") {
      const order = orders.find((o) => o.id === editingCell.orderId);
      if (order && order.estado !== "Agotado" && order.estado !== "Entregado") {
        const days = businessDaysSince(editValue);
        if (days > 30) {
          updates.estado = "Atrasado";
        } else if (order.estado === "Atrasado") {
          updates.estado = "Pendiente";
        }
      }
    }

    await onUpdate(editingCell.orderId, updates);
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const getFieldValue = (orderId: string, field: EditingCell["field"]) => {
    const order = orders.find((o) => o.id === orderId);
    return order ? order[field] : "";
  };

  const renderCell = (
    order: CelesaOrder,
    field: EditingCell["field"]
  ) => {
    const isEditing =
      editingCell?.orderId === order.id && editingCell?.field === field;

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
          type={field === "fechaPedido" ? "date" : "text"}
          className="h-7 text-xs w-full min-w-[80px]"
        />
      );
    }

    return (
      <span
        onClick={() => startEdit(order.id, field, order[field])}
        className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 block truncate"
        title={order[field]}
      >
        {order[field] || "—"}
      </span>
    );
  };

  const renderStatusSelect = (order: CelesaOrder) => {
    const config = CELESA_STATUS_CONFIG[order.estado];
    return (
      <select
        value={order.estado}
        onChange={(e) => {
          const newStatus = e.target.value as CelesaStatus;
          const days = order.fechaPedido ? businessDaysSince(order.fechaPedido) : 0;
          if (days > 30 && newStatus !== "Agotado" && newStatus !== "Entregado") {
            onUpdate(order.id, { estado: "Atrasado" });
          } else {
            onUpdate(order.id, { estado: newStatus });
          }
        }}
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring appearance-none",
          config.bg,
          config.text
        )}
      >
        {CELESA_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  };

  const renderDays = (order: CelesaOrder) => {
    if (!order.fechaPedido || order.estado === "Entregado") return "—";
    const days = businessDaysSince(order.fechaPedido);
    const color =
      days <= 20
        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        : days <= 30
          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
          color
        )}
      >
        {days > 30 && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}
        {days}d
      </span>
    );
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[130px]">N° Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead className="w-[120px]">Fecha</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
              <TableHead className="w-[80px] text-center">Días</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
            {/* New row */}
            <TableRow className="bg-primary/5">
              <TableHead className="p-1">
                <Input
                  placeholder="N° pedido"
                  value={newRow.numeroPedido}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, numeroPedido: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="p-1">
                <Input
                  placeholder="Cliente"
                  value={newRow.cliente}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, cliente: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="p-1">
                <Input
                  placeholder="Producto"
                  value={newRow.producto}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, producto: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="p-1">
                <Input
                  placeholder="ISBN"
                  value={newRow.isbn}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, isbn: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="p-1">
                <Input
                  type="date"
                  value={newRow.fechaPedido}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, fechaPedido: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="p-1">
                <select
                  value={newRow.estado}
                  onChange={(e) =>
                    setNewRow((r) => ({
                      ...r,
                      estado: e.target.value as CelesaStatus,
                    }))
                  }
                  className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {CELESA_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </TableHead>
              <TableHead className="p-1" />
              <TableHead className="p-1" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-12"
                >
                  No hay pedidos. Agrega uno desde la fila superior.
                </TableCell>
              </TableRow>
            )}
            {orders.map((order) => (
              <TableRow key={order.id} className="group">
                <TableCell className="text-sm font-medium">
                  {renderCell(order, "numeroPedido")}
                </TableCell>
                <TableCell className="text-sm">
                  {renderCell(order, "cliente")}
                </TableCell>
                <TableCell className="text-sm">
                  {renderCell(order, "producto")}
                </TableCell>
                <TableCell className="text-sm">
                  {renderCell(order, "isbn")}
                </TableCell>
                <TableCell className="text-sm">
                  {renderCell(order, "fechaPedido")}
                </TableCell>
                <TableCell>{renderStatusSelect(order)}</TableCell>
                <TableCell className="text-center">
                  {renderDays(order)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        startEdit(order.id, "numeroPedido", order.numeroPedido)
                      }
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(order.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
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
            <AlertDialogTitle>Eliminar pedido</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este pedido? Esta acción no se
              puede deshacer.
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
