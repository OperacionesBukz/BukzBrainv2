import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import type { CmvProduct } from "../types";

interface CmvTableProps {
  products: CmvProduct[];
}

type SortKey =
  | "factura"
  | "fecha"
  | "producto"
  | "isbn"
  | "vendor"
  | "cantidad"
  | "valorUnitario"
  | "valorTotal"
  | "margen"
  | "costo"
  | "costoTotal";

type SortDir = "asc" | "desc";

const ROWS_PER_PAGE = 50;

const baseColumns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "factura", label: "Factura" },
  { key: "fecha", label: "Fecha" },
  { key: "producto", label: "Producto" },
  { key: "isbn", label: "ISBN" },
  { key: "vendor", label: "Vendor" },
  { key: "cantidad", label: "Cantidad", numeric: true },
  { key: "valorUnitario", label: "Valor Unit.", numeric: true },
  { key: "valorTotal", label: "Valor Total", numeric: true },
];

const costColumns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "margen", label: "Margen", numeric: true },
  { key: "costo", label: "Costo Unit.", numeric: true },
  { key: "costoTotal", label: "Costo Total", numeric: true },
];

function formatCop(value: number): string {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function CmvTable({ products }: CmvTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("factura");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const hasCostData = useMemo(
    () => products.some((p) => p.costoTotal > 0),
    [products]
  );
  const columns = useMemo(
    () => (hasCostData ? [...baseColumns, ...costColumns] : baseColumns),
    [hasCostData]
  );

  // Filtrar por búsqueda
  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.factura.toLowerCase().includes(q) ||
        p.producto.toLowerCase().includes(q) ||
        p.isbn.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.terceroNombre.toLowerCase().includes(q)
    );
  }, [products, search]);

  // Ordenar
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // Paginar
  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(0);
  }

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por factura, producto, ISBN, vendor..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      <ScrollArea className="w-full rounded-md border">
        <div className="min-w-[1100px]">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "cursor-pointer select-none whitespace-nowrap",
                      col.numeric && "text-right"
                    )}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className={cn("flex items-center gap-1", col.numeric && "justify-end")}>
                      {col.label}
                      <ArrowUpDown
                        className={cn(
                          "h-3 w-3",
                          sortKey === col.key ? "opacity-100" : "opacity-30"
                        )}
                      />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                pageData.map((p) => (
                  <TableRow key={`${p.factura}-${p.isbn}-${p.tercero}-${p.valorTotal}`}>
                    <TableCell className="font-mono text-xs">{p.factura}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.fecha}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={p.producto}>
                      {p.producto}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.isbn}</TableCell>
                    <TableCell>{p.vendor || "—"}</TableCell>
                    <TableCell className="text-right">{p.cantidad}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCop(p.valorUnitario)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCop(p.valorTotal)}</TableCell>
                    {hasCostData && (
                      <>
                        <TableCell className="text-right">{(p.margen * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCop(p.costo)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCop(p.costoTotal)}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString("es-CO")} productos
          {search && ` (de ${products.length.toLocaleString("es-CO")} total)`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pag. {currentPage + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
