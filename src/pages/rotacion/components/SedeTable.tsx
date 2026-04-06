import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SedeRotacion, TurnoverTotals } from "../types";

interface SedeTableProps {
  sedes: SedeRotacion[];
  totales: TurnoverTotals;
}

const SEMAFORO_BADGE = {
  verde: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  amarillo: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  rojo: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const SEMAFORO_LABEL = {
  verde: "Buena",
  amarillo: "Regular",
  rojo: "Baja",
};

function fmt(n: number): string {
  return n.toLocaleString("es-CO");
}

export default function SedeTable({ sedes, totales }: SedeTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Detalle por Sede</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Inventario</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Rotacion</TableHead>
                <TableHead className="text-right">Dias Inv.</TableHead>
                <TableHead className="text-right">Sell-Through</TableHead>
                <TableHead className="text-right">Venta/Dia</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sedes.map((s) => (
                <TableRow key={s.sede}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {s.sede.replace("Bukz ", "")}
                  </TableCell>
                  <TableCell className="text-right">{fmt(s.inventario_unidades)}</TableCell>
                  <TableCell className="text-right">{fmt(s.vendidas_unidades)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {s.rotacion != null ? `${s.rotacion}x` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.dias_inventario != null ? `${s.dias_inventario}d` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.sell_through_pct != null ? `${s.sell_through_pct}%` : "-"}
                  </TableCell>
                  <TableCell className="text-right">{s.venta_diaria}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn("text-xs", SEMAFORO_BADGE[s.semaforo])}>
                      {SEMAFORO_LABEL[s.semaforo]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{fmt(totales.inventario_unidades)}</TableCell>
                <TableCell className="text-right">{fmt(totales.vendidas_unidades)}</TableCell>
                <TableCell className="text-right">
                  {totales.rotacion != null ? `${totales.rotacion}x` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {totales.dias_inventario != null ? `${totales.dias_inventario}d` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {totales.sell_through_pct != null ? `${totales.sell_through_pct}%` : "-"}
                </TableCell>
                <TableCell className="text-right">{totales.venta_diaria}</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", SEMAFORO_BADGE[totales.semaforo])}
                  >
                    {SEMAFORO_LABEL[totales.semaforo]}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
