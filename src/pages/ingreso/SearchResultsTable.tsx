import { Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { ProductSearchResult } from "./types";

interface SearchResultsTableProps {
  data: ProductSearchResult[];
  onDownload?: () => void;
}

export default function SearchResultsTable({
  data,
  onDownload,
}: SearchResultsTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-2">
      {onDownload && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Descargar Excel
          </Button>
        </div>
      )}
      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">ISBN</TableHead>
              <TableHead className="min-w-[100px]">ID</TableHead>
              <TableHead className="min-w-[110px]">Variant ID</TableHead>
              <TableHead className="min-w-[250px]">Título</TableHead>
              <TableHead className="min-w-[140px]">Vendor</TableHead>
              <TableHead className="min-w-[90px] text-right">Precio</TableHead>
              <TableHead className="min-w-[140px]">Categoría</TableHead>
              <TableHead className="min-w-[90px] text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => {
              const found = row.Titulo !== "No encontrado";
              return (
                <TableRow key={`${row.ISBN}-${i}`}>
                  <TableCell className="font-mono text-sm">{row.ISBN}</TableCell>
                  <TableCell>{found ? row.ID : "—"}</TableCell>
                  <TableCell>{found ? row["Variant ID"] : "—"}</TableCell>
                  <TableCell>
                    {found ? (
                      row.Titulo
                    ) : (
                      <Badge variant="destructive">No encontrado</Badge>
                    )}
                  </TableCell>
                  <TableCell>{found ? row.Vendor : "—"}</TableCell>
                  <TableCell className="text-right">
                    {found && row.Precio != null ? `$${row.Precio}` : "—"}
                  </TableCell>
                  <TableCell>{found ? row.Categoria : "—"}</TableCell>
                  <TableCell className="text-right">
                    {row.Cantidad != null ? row.Cantidad : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
