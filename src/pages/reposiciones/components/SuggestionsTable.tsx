import { useMemo, useState, useRef, useEffect } from "react";
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
import { Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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

  const inputRef = useRef<HTMLInputElement>(null);

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

  // Filtered products: apply search and urgency filter
  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return effectiveProducts.filter((p) => {
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
  }, [effectiveProducts, searchTerm, urgencyFilter]);

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
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Ventas/mes</TableHead>
                  <TableHead className="text-center">Urgencia</TableHead>
                  <TableHead className="text-right">Sugerido</TableHead>
                  <TableHead className="text-right">En Transito</TableHead>
                  <TableHead className="text-center">Clasificacion</TableHead>
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
