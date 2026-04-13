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

const SEMAFORO_BAR = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-500",
  rojo: "bg-red-500",
};

const SEMAFORO_BORDER = {
  verde: "border-l-[3px] border-l-green-500",
  amarillo: "border-l-[3px] border-l-yellow-500",
  rojo: "border-l-[3px] border-l-red-500",
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
  const maxRotacion = Math.max(...sedes.map((s) => s.rotacion ?? 0), 1);
  const maxSellThrough = Math.max(...sedes.map((s) => s.sell_through_pct ?? 0), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">Detalle por Sede</CardTitle>
          <Badge variant="secondary" className="text-xs font-mono">
            {sedes.length} sedes
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border">
                <TableHead className="sticky left-0 bg-muted/50 dark:bg-muted/30 z-10 text-[11px] uppercase tracking-wider font-semibold">
                  Sede
                </TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold">Inventario</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold">Ventas</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold">Rotacion</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold">Dias Inv.</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold">Sell-Through</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold">Venta/Dia</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sedes.map((s) => {
                const rotPct = s.rotacion != null ? (s.rotacion / maxRotacion) * 100 : 0;
                const stPct = s.sell_through_pct != null ? (s.sell_through_pct / maxSellThrough) * 100 : 0;

                return (
                  <TableRow
                    key={s.sede}
                    className={cn("group transition-colors hover:bg-muted/50", SEMAFORO_BORDER[s.semaforo])}
                  >
                    <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-card group-hover:bg-muted/50 z-10 transition-colors">
                      {s.sede.replace("Bukz ", "")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(s.inventario_unidades)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(s.vendidas_unidades)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold tabular-nums">
                          {s.rotacion != null ? `${s.rotacion}x` : "-"}
                        </span>
                        <div className="w-[80px] h-[10px] rounded-full bg-muted/80 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", SEMAFORO_BAR[s.semaforo])}
                            style={{ width: `${rotPct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.dias_inventario != null ? `${s.dias_inventario}d` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums">
                          {s.sell_through_pct != null ? `${s.sell_through_pct}%` : "-"}
                        </span>
                        <div className="w-[64px] h-[10px] rounded-full bg-muted/80 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", SEMAFORO_BAR[s.semaforo])}
                            style={{ width: `${stPct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.venta_diaria}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("text-xs font-semibold", SEMAFORO_BADGE[s.semaforo])}>
                        {SEMAFORO_LABEL[s.semaforo]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total row */}
              <TableRow className="font-bold bg-primary/5 dark:bg-primary/10 border-t-2 border-primary/30">
                <TableCell className="sticky left-0 bg-muted z-10 text-primary uppercase tracking-wide">
                  TOTAL
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(totales.inventario_unidades)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(totales.vendidas_unidades)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totales.rotacion != null ? `${totales.rotacion}x` : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totales.dias_inventario != null ? `${totales.dias_inventario}d` : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totales.sell_through_pct != null ? `${totales.sell_through_pct}%` : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{totales.venta_diaria}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={cn("text-xs font-semibold", SEMAFORO_BADGE[totales.semaforo])}>
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
