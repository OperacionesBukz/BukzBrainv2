import { useState, useMemo, useCallback } from "react";
import { Search, Download, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CortesRow } from "./types";

type SortKey = keyof CortesRow;
type SortDir = "asc" | "desc" | null;

interface CortesResultTableProps {
  rows: CortesRow[];
  onDownload: () => void;
}

const columns: { key: SortKey; label: string; align?: "center" }[] = [
  { key: "orderName", label: "Pedido" },
  { key: "sku", label: "SKU" },
  { key: "productTitle", label: "Producto" },
  { key: "vendor", label: "Editorial" },
  { key: "discountName", label: "Descuento" },
  { key: "netItemsSold", label: "Uds.", align: "center" },
  { key: "udsConDescuento", label: "Uds. Desc.", align: "center" },
  { key: "detalle", label: "Detalle" },
];

export default function CortesResultTable({ rows, onDownload }: CortesResultTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }, [sortKey, sortDir]);

  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.orderName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.productTitle.toLowerCase().includes(q) ||
          r.vendor.toLowerCase().includes(q) ||
          r.detalle.toLowerCase().includes(q)
      );
    }
    if (sortKey && sortDir) {
      result = [...result].sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (typeof va === "number" && typeof vb === "number") {
          return sortDir === "asc" ? va - vb : vb - va;
        }
        const sa = String(va).toLowerCase();
        const sb = String(vb).toLowerCase();
        return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }
    return result;
  }, [rows, search, sortKey, sortDir]);

  const regalosCount = rows.filter((r) => r.detalle === "Regalo").length;
  const noAplicaCount = rows.filter((r) => r.detalle === "NO APLICA").length;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

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
          <thead className="bg-background sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2 font-medium select-none cursor-pointer hover:bg-muted/50 transition-colors ${
                    col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
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
