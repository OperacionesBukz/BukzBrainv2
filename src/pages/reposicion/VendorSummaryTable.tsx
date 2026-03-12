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
import { Factory } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VendorSummary } from "./types";

interface VendorSummaryTableProps {
  vendors: VendorSummary[];
}

export default function VendorSummaryTable({ vendors }: VendorSummaryTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Factory className="h-4 w-4" />
          Resumen por Proveedor ({vendors.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor / Editorial</TableHead>
                <TableHead className="text-center">Títulos</TableHead>
                <TableHead className="text-center">Unidades</TableHead>
                <TableHead className="text-center">Urgentes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.vendor}>
                  <TableCell className="font-medium">{v.vendor}</TableCell>
                  <TableCell className="text-center font-mono">{v.titles}</TableCell>
                  <TableCell className="text-center font-mono">{v.units}</TableCell>
                  <TableCell className="text-center">
                    {v.urgentCount > 0 ? (
                      <Badge variant="destructive">{v.urgentCount}</Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
