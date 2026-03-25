import { useState, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CortesRow } from "./types";

interface CortesResultTableProps {
  rows: CortesRow[];
  onDownload: () => void;
}

export default function CortesResultTable({ rows, onDownload }: CortesResultTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.orderName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.productTitle.toLowerCase().includes(q) ||
        r.vendor.toLowerCase().includes(q) ||
        r.detalle.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const regalosCount = rows.filter((r) => r.detalle === "Regalo").length;
  const noAplicaCount = rows.filter((r) => r.detalle === "NO APLICA").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filtered.length} filas</span>
            <span>·</span>
            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white">
              {regalosCount} regalos
            </Badge>
            <Badge variant="secondary">
              {noAplicaCount} no aplica
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          Descargar Excel
        </Button>
      </div>

      <div className="overflow-auto border rounded-md max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Pedido</th>
              <th className="text-left px-3 py-2 font-medium">SKU</th>
              <th className="text-left px-3 py-2 font-medium">Producto</th>
              <th className="text-left px-3 py-2 font-medium">Editorial</th>
              <th className="text-left px-3 py-2 font-medium">Descuento</th>
              <th className="text-left px-3 py-2 font-medium">Uds.</th>
              <th className="text-left px-3 py-2 font-medium">Uds. Desc.</th>
              <th className="text-left px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((row, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="px-3 py-1.5 whitespace-nowrap">{row.orderName}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{row.sku}</td>
                <td className="px-3 py-1.5 max-w-[250px] truncate">{row.productTitle}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.vendor}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.discountName}</td>
                <td className="px-3 py-1.5 text-center">{row.netItemsSold}</td>
                <td className="px-3 py-1.5 text-center">{row.udsConDescuento}</td>
                <td className="px-3 py-1.5">
                  {row.detalle === "Regalo" && (
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white">
                      Regalo
                    </Badge>
                  )}
                  {row.detalle === "NO APLICA" && (
                    <Badge variant="secondary">NO APLICA</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
