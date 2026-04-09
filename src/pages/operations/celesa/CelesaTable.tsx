import { useState, useRef } from "react";
import { Copy, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { StringDatePicker } from "@/components/ui/date-picker";
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
  onDuplicate: (order: CelesaOrder) => void;
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
  onDuplicate,
}: CelesaTableProps) {
  const isMobile = useIsMobile();
  const [newRow, setNewRow] = useState({ ...emptyNew });
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showMobileForm, setShowMobileForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddRow = async () => {
    if (!newRow.numeroPedido.trim() || !newRow.cliente.trim()) return;
    const numero = newRow.numeroPedido.trim().startsWith("#")
      ? newRow.numeroPedido.trim()
      : `#${newRow.numeroPedido.trim()}`;
    await onAdd({ ...newRow, numeroPedido: numero });
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
      if (field === "fechaPedido") {
        return (
          <StringDatePicker
            value={editValue}
            onChange={(val) => {
              // Ignorar si se intenta limpiar la fecha (click en "X")
              if (!val) {
                setEditingCell(null);
                return;
              }
              const updates: Record<string, string> = { fechaPedido: val };
              if (order.estado !== "Agotado" && order.estado !== "Entregado") {
                const days = businessDaysSince(val);
                if (days > 30) {
                  updates.estado = "Atrasado";
                } else if (order.estado === "Atrasado") {
                  updates.estado = "Pendiente";
                }
              }
              onUpdate(order.id, updates);
              setEditingCell(null);
            }}
            className="h-7 text-xs"
          />
        );
      }
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

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            onClick={() => startEdit(order.id, field, order[field])}
            className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 block truncate"
          >
            {order[field] || "—"}
          </span>
        </TooltipTrigger>
        {order[field] && (
          <TooltipContent side="bottom" className="max-w-xs">
            {order[field]}
          </TooltipContent>
        )}
      </Tooltip>
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

  /* ── Mobile: new row form ── */
  const renderMobileNewRow = () => {
    if (!showMobileForm) return null;
    return (
      <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Nuevo pedido</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowMobileForm(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Input
          placeholder="N° pedido"
          value={newRow.numeroPedido}
          onChange={(e) =>
            setNewRow((r) => ({ ...r, numeroPedido: e.target.value }))
          }
          className="h-9 text-sm"
        />
        <Input
          placeholder="Cliente"
          value={newRow.cliente}
          onChange={(e) =>
            setNewRow((r) => ({ ...r, cliente: e.target.value }))
          }
          className="h-9 text-sm"
        />
        <Input
          placeholder="Producto"
          value={newRow.producto}
          onChange={(e) =>
            setNewRow((r) => ({ ...r, producto: e.target.value }))
          }
          className="h-9 text-sm"
        />
        <Input
          placeholder="ISBN"
          value={newRow.isbn}
          onChange={(e) =>
            setNewRow((r) => ({ ...r, isbn: e.target.value }))
          }
          className="h-9 text-sm"
        />
        <StringDatePicker
          value={newRow.fechaPedido}
          onChange={(val) => setNewRow((r) => ({ ...r, fechaPedido: val }))}
          className="h-9 text-sm w-full"
        />
        <select
          value={newRow.estado}
          onChange={(e) =>
            setNewRow((r) => ({
              ...r,
              estado: e.target.value as CelesaStatus,
            }))
          }
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {CELESA_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button
          className="w-full"
          size="sm"
          onClick={async () => {
            await handleAddRow();
            setShowMobileForm(false);
          }}
          disabled={!newRow.numeroPedido.trim() || !newRow.cliente.trim()}
        >
          Agregar pedido
        </Button>
      </div>
    );
  };

  /* ── Mobile: single order card ── */
  const renderMobileCard = (order: CelesaOrder) => {
    const isEditingField = (field: EditingCell["field"]) =>
      editingCell?.orderId === order.id && editingCell?.field === field;

    return (
      <div
        key={order.id}
        className="rounded-lg border bg-card p-3 space-y-2"
      >
        {/* Row 1: Status + Days */}
        <div className="flex items-center justify-between">
          {renderStatusSelect(order)}
          {renderDays(order)}
        </div>

        {/* Row 2: Pedido + Cliente */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          {isEditingField("numeroPedido") ? (
            <div className="flex-1 min-w-0">
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
                className="h-8 text-sm font-semibold"
              />
            </div>
          ) : (
            <span
              onClick={() =>
                startEdit(order.id, "numeroPedido", order.numeroPedido)
              }
              className="text-sm font-semibold cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 shrink-0"
            >
              {order.numeroPedido || "—"}
            </span>
          )}
          <span className="text-muted-foreground text-xs">·</span>
          {isEditingField("cliente") ? (
            <div className="flex-1 min-w-0">
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
                className="h-8 text-sm"
              />
            </div>
          ) : (
            <span
              onClick={() => startEdit(order.id, "cliente", order.cliente)}
              className="text-sm truncate cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 min-w-0"
            >
              {order.cliente || "—"}
            </span>
          )}
        </div>

        {/* Row 3: Producto */}
        {isEditingField("producto") ? (
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
            className="h-8 text-xs"
          />
        ) : (
          <p
            onClick={() => startEdit(order.id, "producto", order.producto)}
            className="text-xs text-muted-foreground truncate cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
          >
            {order.producto || "Sin producto"}
          </p>
        )}

        {/* Row 4: ISBN + Fecha */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isEditingField("isbn") ? (
            <div className="flex-1 min-w-0">
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
                className="h-7 text-xs"
              />
            </div>
          ) : (
            <span
              onClick={() => startEdit(order.id, "isbn", order.isbn)}
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
            >
              {order.isbn || "Sin ISBN"}
            </span>
          )}
          <span>·</span>
          {isEditingField("fechaPedido") ? (
            <StringDatePicker
              value={editValue}
              onChange={(val) => {
                if (!val) {
                  setEditingCell(null);
                  return;
                }
                const updates: Record<string, string> = { fechaPedido: val };
                if (
                  order.estado !== "Agotado" &&
                  order.estado !== "Entregado"
                ) {
                  const days = businessDaysSince(val);
                  if (days > 30) {
                    updates.estado = "Atrasado";
                  } else if (order.estado === "Atrasado") {
                    updates.estado = "Pendiente";
                  }
                }
                onUpdate(order.id, updates);
                setEditingCell(null);
              }}
              className="h-7 text-xs"
            />
          ) : (
            <span
              onClick={() =>
                startEdit(order.id, "fechaPedido", order.fechaPedido)
              }
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
            >
              {order.fechaPedido || "Sin fecha"}
            </span>
          )}
        </div>

        {/* Row 5: Actions */}
        <div className="flex gap-1 pt-1 border-t">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onDuplicate(order)}
            title="Duplicar pedido"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() =>
              startEdit(order.id, "numeroPedido", order.numeroPedido)
            }
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-destructive hover:text-destructive"
            onClick={() => setDeleteId(order.id)}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  /* ── Mobile: full view ── */
  const renderMobileView = () => (
    <>
      <div className="space-y-3">
        {renderMobileNewRow()}

        {orders.length === 0 && !showMobileForm && (
          <div className="text-center text-muted-foreground py-12 border rounded-lg">
            No hay pedidos. Toca el botón + para agregar uno.
          </div>
        )}

        {orders.map((order) => renderMobileCard(order))}
      </div>

      {/* FAB */}
      {!showMobileForm && (
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          onClick={() => setShowMobileForm(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

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

  if (isMobile) return renderMobileView();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="table-fixed">
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
                <StringDatePicker
                  value={newRow.fechaPedido}
                  onChange={(val) => {
                    const numero = newRow.numeroPedido.trim();
                    const cliente = newRow.cliente.trim();
                    if (numero && cliente) {
                      const numeroPedido = numero.startsWith("#") ? numero : `#${numero}`;
                      onAdd({ ...newRow, numeroPedido, fechaPedido: val });
                      setNewRow({ ...emptyNew });
                    } else {
                      setNewRow((r) => ({ ...r, fechaPedido: val }));
                    }
                  }}
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
                      onClick={() => onDuplicate(order)}
                      title="Duplicar pedido"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
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
    </TooltipProvider>
  );
}
