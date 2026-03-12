import { useMemo, useState } from "react";
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
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductAnalysis, UrgencyLevel } from "./types";

interface ProductDetailTableProps {
  products: ProductAnalysis[];
}

const PAGE_SIZE = 25;

const urgencyBadgeVariant: Record<UrgencyLevel, "destructive" | "outline" | "secondary" | "default"> = {
  URGENTE: "destructive",
  PRONTO: "outline",
  NORMAL: "secondary",
  OK: "default",
};

const urgencyRowClass: Record<UrgencyLevel, string> = {
  URGENTE: "bg-destructive/10",
  PRONTO: "bg-amber-500/10",
  NORMAL: "bg-emerald-500/10",
  OK: "",
};

export default function ProductDetailTable({ products }: ProductDetailTableProps) {
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (urgencyFilter !== "all" && p.urgency !== urgencyFilter) return false;
      if (q) {
        return (
          p.sku.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, search, urgencyFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0));
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleUrgencyChange = (value: string) => {
    setUrgencyFilter(value);
    setPage(0);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Detalle de Productos ({filtered.length})
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Buscar ISBN, título o proveedor..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full sm:w-60"
            />
            <Select value={urgencyFilter} onValueChange={handleUrgencyChange}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las urgencias</SelectItem>
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
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISBN</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-center">Clasif.</TableHead>
                  <TableHead className="text-center">Vta/Mes</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Días Inv.</TableHead>
                  <TableHead className="text-center">Urgencia</TableHead>
                  <TableHead className="text-center">Pedir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => (
                  <TableRow key={p.sku} className={urgencyRowClass[p.urgency]}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{p.title}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">
                      {p.vendor}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      <Badge variant="outline" className="text-xs">
                        {p.classificationLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{p.salesPerMonth}</TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-mono",
                        p.stock === 0 && "font-bold text-destructive"
                      )}
                    >
                      {p.stock}
                    </TableCell>
                    <TableCell className="text-center font-mono">{p.daysOfInventory}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={urgencyBadgeVariant[p.urgency]} className="text-xs">
                        {p.urgencyLabel}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-mono",
                        p.orderQuantity > 0 ? "font-bold text-primary" : "text-muted-foreground"
                      )}
                    >
                      {p.orderQuantity > 0 ? p.orderQuantity : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
