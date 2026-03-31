import { useCallback, useMemo, useState, useRef, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductResult, UrgencyLevel } from "../types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SuggestionsTableProps {
  products: ProductResult[];
  overridesMap: Record<string, number>;
  onOverrideChange: (sku: string, qty: number) => void;
  deletedSkus: Set<string>;
  onDeleteSku: (sku: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

type SortKey = "sku" | "title" | "vendor" | "stock" | "sales_per_month" | "urgency" | "suggested_qty" | "in_transit_real" | "classification";
type SortDir = "asc" | "desc";

const NUMERIC_KEYS: Set<SortKey> = new Set(["stock", "sales_per_month", "suggested_qty", "in_transit_real"]);

const URGENCY_ORDER: Record<UrgencyLevel, number> = {
  URGENTE: 0,
  PRONTO: 1,
  NORMAL: 2,
  OK: 3,
};

const urgencyBadgeClass: Record<UrgencyLevel, string> = {
  URGENTE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  PRONTO: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  NORMAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  OK: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuggestionsTable({
  products,
  overridesMap,
  onOverrideChange,
  deletedSkus,
  onDeleteSku,
}: SuggestionsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | "ALL">("ALL");
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const inputRef = useRef<HTMLInputElement>(null);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  }, [sortKey]);

  const resetSort = useCallback(() => {
    setSortKey(null);
    setSortDir("asc");
    setCurrentPage(1);
  }, []);

  const SortableHead = ({ label, sortField, className }: { label: string; sortField: SortKey; className?: string }) => (
    <TableHead
      className={cn("group/sort cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
      onClick={() => toggleSort(sortField)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortField ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover/sort:opacity-30 transition-opacity" />
        )}
      </span>
    </TableHead>
  );

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  // Effective products: apply overrides, exclude deleted
  const effectiveProducts = useMemo(
    () =>
      products
        .filter((p) => !deletedSkus.has(p.sku))
        .map((p) => ({
          ...p,
          suggested_qty: overridesMap[p.sku] ?? p.suggested_qty,
        })),
    [products, deletedSkus, overridesMap]
  );

  // Filtered + sorted products
  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const filtered = effectiveProducts.filter((p) => {
      if (urgencyFilter !== "ALL" && p.urgency !== urgencyFilter) return false;
      if (q) {
        return (
          p.sku.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Default sort: urgency first, then sales descending
    if (!sortKey) {
      return filtered.sort((a, b) => {
        const urgDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
        if (urgDiff !== 0) return urgDiff;
        return b.total_sold - a.total_sold;
      });
    }

    // Custom column sort
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "urgency") {
        cmp = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      } else if (sortKey === "classification") {
        cmp = a.classification_label.localeCompare(b.classification_label);
      } else if (NUMERIC_KEYS.has(sortKey)) {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [effectiveProducts, searchTerm, urgencyFilter, sortKey, sortDir]);

  // Paginated products
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const startItem = filteredProducts.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, filteredProducts.length);

  // Reset to page 1 on filter changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleUrgencyFilterChange = (value: string) => {
    setUrgencyFilter(value as UrgencyLevel | "ALL");
    setCurrentPage(1);
  };

  // Inline edit handlers
  const startEdit = (sku: string, currentQty: number) => {
    setEditingCell(sku);
    setEditingValue(String(currentQty));
  };

  const commitEdit = (sku: string) => {
    const parsed = parseInt(editingValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onOverrideChange(sku, parsed);
    }
    setEditingCell(null);
    setEditingValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, sku: string) => {
    if (e.key === "Enter") {
      commitEdit(sku);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">
            Sugeridos de Reposicion ({filteredProducts.length})
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU, titulo o proveedor..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 w-full sm:w-72"
              />
            </div>
            {/* Urgency filter */}
            <Select value={urgencyFilter} onValueChange={handleUrgencyFilterChange}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="URGENTE">Urgente</SelectItem>
                <SelectItem value="PRONTO">Pronto</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="OK">OK</SelectItem>
              </SelectContent>
            </Select>
            {/* Reset sort button */}
            {sortKey !== null && (
              <Button variant="outline" size="sm" onClick={resetSort} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Reiniciar orden
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="SKU" sortField="sku" />
                  <SortableHead label="Titulo" sortField="title" />
                  <SortableHead label="Proveedor" sortField="vendor" />
                  <SortableHead label="Stock" sortField="stock" className="text-right" />
                  <SortableHead label="Ventas/mes" sortField="sales_per_month" className="text-right" />
                  <SortableHead label="Urgencia" sortField="urgency" className="text-center" />
                  <SortableHead label="Sugerido" sortField="suggested_qty" className="text-right" />
                  <SortableHead label="En Transito" sortField="in_transit_real" className="text-right" />
                  <SortableHead label="Clasificacion" sortField="classification" className="text-center" />
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No se encontraron productos con los filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((p) => (
                    <TableRow key={p.sku}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={p.title}
                      >
                        {p.title}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-muted-foreground">
                        {p.vendor}
                      </TableCell>
                      <TableCell className="text-right font-mono">{p.stock}</TableCell>
                      <TableCell className="text-right font-mono">
                        {p.sales_per_month.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-xs border-0",
                            urgencyBadgeClass[p.urgency]
                          )}
                        >
                          {p.urgency_label}
                        </Badge>
                      </TableCell>
                      {/* Inline editable suggested_qty */}
                      <TableCell className="text-right">
                        {editingCell === p.sku ? (
                          <Input
                            ref={inputRef}
                            type="number"
                            min={0}
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => commitEdit(p.sku)}
                            onKeyDown={(e) => handleKeyDown(e, p.sku)}
                            className="w-20 h-8 text-right"
                          />
                        ) : (
                          <span
                            className="font-mono cursor-pointer rounded px-1 hover:bg-muted transition-colors"
                            onClick={() => startEdit(p.sku, p.suggested_qty)}
                          >
                            {p.suggested_qty}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {p.in_transit_real}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {p.classification_label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDeleteSku(p.sku)}
                          title="Eliminar fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <span className="text-sm text-muted-foreground">
            {filteredProducts.length === 0
              ? "Sin productos"
              : `Mostrando ${startItem}-${endItem} de ${filteredProducts.length} productos`}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(safePage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
