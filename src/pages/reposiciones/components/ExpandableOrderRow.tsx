import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useOrderDetail, useExportSingleOrder } from "../hooks";
import type { OrderListItem } from "../types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpandableOrderRowProps {
  order: OrderListItem;
  statusBadge: { label: string; className: string };
  transitions: { label: string; value: string }[];
  onTransition: (orderId: string, newStatus: string) => void;
  isTransitioning: boolean;
  onDelete: (orderId: string) => void;
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatDate(isoString: string | undefined): string {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return isoString;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpandableOrderRow({
  order,
  statusBadge,
  transitions,
  onTransition,
  isTransitioning,
  onDelete,
}: ExpandableOrderRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only fetch detail when expanded (per RESEARCH.md pitfall)
  const detail = useOrderDetail(isOpen ? order.order_id : null);
  const exportMutation = useExportSingleOrder();

  return (
    <Collapsible asChild open={isOpen} onOpenChange={setIsOpen}>
      <>
        {/* Main row */}
        <TableRow
          className="cursor-pointer hover:bg-muted/50"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {/* Proveedor */}
          <TableCell className="font-medium">{order.vendor}</TableCell>

          {/* Fecha Creacion */}
          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(order.created_at)}
          </TableCell>

          {/* Estado */}
          <TableCell>
            <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
          </TableCell>

          {/* Items */}
          <TableCell className="font-mono">{order.item_count}</TableCell>

          {/* Acciones */}
          <TableCell>
            <div className="flex gap-1 flex-wrap items-center" onClick={(e) => e.stopPropagation()}>
              {transitions.map((t) => (
                <Button
                  key={t.value}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={isTransitioning}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransition(order.order_id, t.value);
                  }}
                >
                  {t.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(order.order_id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TableCell>

          {/* Expand toggle */}
          <CollapsibleTrigger asChild>
            <TableCell className="w-8 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </TableCell>
          </CollapsibleTrigger>
        </TableRow>

        {/* Expanded detail row */}
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            <TableCell colSpan={6} className="py-4">
              <div className="space-y-4 px-2">
                {/* SKU detail table */}
                <div>
                  <p className="text-sm font-semibold mb-2">Detalle de SKUs</p>
                  {detail.isLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando detalle...</p>
                  ) : detail.data ? (
                    <div className="overflow-x-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Titulo</TableHead>
                            <TableHead className="text-xs text-right">Cantidad</TableHead>
                            <TableHead className="text-xs text-right">Stock</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.data.items.map((item) => (
                            <TableRow key={item.sku}>
                              <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                              <TableCell className="text-xs">{item.title}</TableCell>
                              <TableCell className="text-xs text-right font-bold font-mono">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono text-muted-foreground">
                                {item.stock}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>

                {/* Audit trail */}
                {detail.data && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Historial</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        Creado por:{" "}
                        <span className="text-foreground font-medium">
                          {detail.data.created_by}
                        </span>{" "}
                        el {formatDate(detail.data.created_at)}
                      </p>
                      {detail.data.approved_by && (
                        <p>
                          Aprobado por:{" "}
                          <span className="text-foreground font-medium">
                            {detail.data.approved_by}
                          </span>{" "}
                          el {formatDate(detail.data.approved_at)}
                        </p>
                      )}
                      {(detail.data.status_history ?? []).map((entry, idx) => (
                        <p key={idx}>
                          <span className="capitalize">{entry.status}</span> por{" "}
                          <span className="text-foreground font-medium">
                            {entry.changed_by}
                          </span>{" "}
                          el {formatDate(entry.changed_at)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download button */}
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportMutation.isPending}
                    onClick={() => exportMutation.mutate(order.order_id)}
                  >
                    {exportMutation.isPending ? "Descargando..." : "Descargar Excel"}
                  </Button>
                </div>
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}
