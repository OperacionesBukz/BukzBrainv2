import { TrendingUp, Calendar, Percent, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TurnoverTotals } from "../types";

interface ResultsSummaryProps {
  totales: TurnoverTotals;
  meses: number;
}

const SEMAFORO_COLORS = {
  verde: "text-green-600 dark:text-green-400",
  amarillo: "text-yellow-600 dark:text-yellow-400",
  rojo: "text-red-600 dark:text-red-400",
};

export default function ResultsSummary({ totales, meses }: ResultsSummaryProps) {
  const cards = [
    {
      label: "Rotacion",
      value: totales.rotacion != null ? `${totales.rotacion}x` : "N/A",
      sub: `en ${meses} meses`,
      icon: TrendingUp,
      color: SEMAFORO_COLORS[totales.semaforo],
    },
    {
      label: "Dias de Inventario",
      value: totales.dias_inventario != null ? `${totales.dias_inventario}` : "N/A",
      sub: "dias de cobertura actual",
      icon: Calendar,
      color: totales.dias_inventario != null && totales.dias_inventario <= 120
        ? SEMAFORO_COLORS.verde
        : totales.dias_inventario != null && totales.dias_inventario <= 180
          ? SEMAFORO_COLORS.amarillo
          : SEMAFORO_COLORS.rojo,
    },
    {
      label: "Sell-Through",
      value: totales.sell_through_pct != null ? `${totales.sell_through_pct}%` : "N/A",
      sub: "del inventario vendido",
      icon: Percent,
      color: "text-foreground",
    },
    {
      label: "Venta Diaria",
      value: `${totales.venta_diaria}`,
      sub: "unidades por dia",
      icon: ShoppingCart,
      color: "text-foreground",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <c.icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className={cn("text-2xl font-bold", c.color)}>{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
