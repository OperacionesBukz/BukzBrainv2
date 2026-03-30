import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Factory } from "lucide-react";
import type { ProductResult } from "../types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface VendorSummaryPanelProps {
  products: ProductResult[];
  overridesMap: Record<string, number>;
  deletedSkus: Set<string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VendorSummaryPanel({
  products,
  overridesMap,
  deletedSkus,
}: VendorSummaryPanelProps) {
  // CRITICAL: Recompute vendor summary from effective products (NOT from backend vendor_summary)
  // This ensures edits and deletions are always reflected.
  const effectiveVendorSummary = useMemo(() => {
    const map: Record<
      string,
      { total_skus: number; total_units_to_order: number; urgent_count: number }
    > = {};

    for (const p of products) {
      if (deletedSkus.has(p.sku)) continue;
      const qty = overridesMap[p.sku] ?? p.suggested_qty;
      if (qty <= 0) continue;
      if (!map[p.vendor]) {
        map[p.vendor] = { total_skus: 0, total_units_to_order: 0, urgent_count: 0 };
      }
      map[p.vendor].total_skus += 1;
      map[p.vendor].total_units_to_order += qty;
      if (p.urgency === "URGENTE") map[p.vendor].urgent_count += 1;
    }

    return Object.entries(map)
      .map(([vendor, v]) => ({ vendor, ...v }))
      .sort(
        (a, b) =>
          b.urgent_count - a.urgent_count ||
          b.total_units_to_order - a.total_units_to_order
      );
  }, [products, overridesMap, deletedSkus]);

  // Compute footer totals
  const totals = useMemo(
    () =>
      effectiveVendorSummary.reduce(
        (acc, v) => ({
          total_skus: acc.total_skus + v.total_skus,
          total_units_to_order: acc.total_units_to_order + v.total_units_to_order,
          urgent_count: acc.urgent_count + v.urgent_count,
        }),
        { total_skus: 0, total_units_to_order: 0, urgent_count: 0 }
      ),
    [effectiveVendorSummary]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Factory className="h-4 w-4" />
          Resumen por Proveedor ({effectiveVendorSummary.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {effectiveVendorSummary.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            Sin productos para pedir
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="min-w-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Titulos</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Urgentes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {effectiveVendorSummary.map((v) => (
                    <TableRow key={v.vendor}>
                      <TableCell className="font-medium">{v.vendor}</TableCell>
                      <TableCell className="text-right font-mono">
                        {v.total_skus}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {v.total_units_to_order}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.urgent_count > 0 ? (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0 text-xs">
                            {v.urgent_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground font-mono">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Footer totals row */}
                  <TableRow className="border-t-2 font-semibold bg-muted/30">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.total_skus}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {totals.total_units_to_order}
                    </TableCell>
                    <TableCell className="text-right">
                      {totals.urgent_count > 0 ? (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0 text-xs">
                          {totals.urgent_count}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground font-mono">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
