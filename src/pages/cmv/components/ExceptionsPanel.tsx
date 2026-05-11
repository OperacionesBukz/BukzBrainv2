import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { CmvProduct, Vendor } from "../types";

interface ExceptionsPanelProps {
  unknownVendorProducts: CmvProduct[];
  vendors: Vendor[];
  onResolveVendor: (isbn: string, vendorName: string) => void;
}

/** Agrupa productos por ISBN y devuelve un resumen por ISBN único */
function groupByIsbn(products: CmvProduct[]) {
  const map = new Map<
    string,
    { isbn: string; producto: string; valorTotal: number; count: number }
  >();

  for (const p of products) {
    const existing = map.get(p.isbn);
    if (existing) {
      existing.valorTotal += p.valorTotal;
      existing.count += 1;
    } else {
      map.set(p.isbn, {
        isbn: p.isbn,
        producto: p.producto,
        valorTotal: p.valorTotal,
        count: 1,
      });
    }
  }

  return Array.from(map.values());
}

export default function ExceptionsPanel({
  unknownVendorProducts,
  vendors,
  onResolveVendor,
}: ExceptionsPanelProps) {
  const isbnGroups = useMemo(
    () => groupByIsbn(unknownVendorProducts),
    [unknownVendorProducts],
  );

  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkVendor, setBulkVendor] = useState<string>("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return isbnGroups;
    return isbnGroups.filter(
      (g) =>
        g.isbn.toLowerCase().includes(q) || g.producto.toLowerCase().includes(q),
    );
  }, [isbnGroups, filter]);

  if (isbnGroups.length === 0) return null;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((g) => selected.has(g.isbn));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filtered.forEach((g) => next.delete(g.isbn));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((g) => next.add(g.isbn));
      setSelected(next);
    }
  };

  const toggleOne = (isbn: string) => {
    const next = new Set(selected);
    if (next.has(isbn)) next.delete(isbn);
    else next.add(isbn);
    setSelected(next);
  };

  const applyBulk = () => {
    if (!bulkVendor || selected.size === 0) return;
    for (const isbn of selected) onResolveVendor(isbn, bulkVendor);
    setSelected(new Set());
    setBulkVendor("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Productos sin Vendor ({unknownVendorProducts.length} items · {isbnGroups.length} ISBNs)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Bulk controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filtrar por ISBN o producto..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {selected.size} seleccionados
          </span>
          <Select value={bulkVendor} onValueChange={setBulkVendor}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Asignar vendor..." />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.name}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={applyBulk}
            disabled={!bulkVendor || selected.size === 0}
          >
            Aplicar a {selected.size}
          </Button>
        </div>

        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todos los visibles"
                  />
                </TableHead>
                <TableHead>ISBN</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="w-[200px]">Vendor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((group) => (
                <TableRow key={group.isbn}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(group.isbn)}
                      onCheckedChange={() => toggleOne(group.isbn)}
                      aria-label={`Seleccionar ${group.isbn}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {group.isbn}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={group.producto}>
                    {group.producto}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.count}
                  </TableCell>
                  <TableCell className="text-right">
                    ${group.valorTotal.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell>
                    <Select
                      onValueChange={(value) =>
                        onResolveVendor(group.isbn, value)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Seleccionar vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
