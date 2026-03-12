import type { CelesaOrder } from "./types";
import { businessDaysSince } from "./types";

export function exportCelesaCSV(orders: CelesaOrder[]) {
  const headers = [
    "N° Pedido",
    "Cliente",
    "Producto",
    "ISBN",
    "Fecha Pedido",
    "Estado",
    "Días Hábiles",
    "Creado por",
  ];

  const rows = orders.map((o) => [
    o.numeroPedido,
    o.cliente,
    o.producto,
    o.isbn || "",
    o.fechaPedido,
    o.estado,
    String(businessDaysSince(o.fechaPedido)),
    o.createdBy,
  ]);

  const csv =
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `celesa_pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
