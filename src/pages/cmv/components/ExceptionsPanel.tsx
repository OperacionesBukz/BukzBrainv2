import { useMemo } from "react";
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

  if (isbnGroups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Productos sin Vendor ({unknownVendorProducts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ISBN</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="w-[200px]">Vendor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isbnGroups.map((group) => (
                <TableRow key={group.isbn}>
                  <TableCell className="font-mono text-sm">
                    {group.isbn}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
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
