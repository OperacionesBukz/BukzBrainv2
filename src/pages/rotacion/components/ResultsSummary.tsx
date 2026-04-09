import { TrendingUp, Calendar, Percent, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TurnoverTotals } from "../types";

interface ResultsSummaryProps {
  totales: TurnoverTotals;
  meses: number;
}

const SEMAFORO_STYLES = {
  verde: { text: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
  amarillo: { text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/40" },
  rojo: { text: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
};

export default function ResultsSummary({ totales, meses }: ResultsSummaryProps) {
  const diasSemaforo =
    totales.dias_inventario != null && totales.dias_inventario <= 120
      ? "verde"
      : totales.dias_inventario != null && totales.dias_inventario <= 180
        ? "amarillo"
        : "rojo";

  const cards = [
    {
      label: "Rotacion",
      value: totales.rotacion != null ? `${totales.rotacion}x` : "N/A",
      sub: `en ${meses} meses`,
      icon: TrendingUp,
      text: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Dias de Inventario",
      value: totales.dias_inventario != null ? `${totales.dias_inventario}` : "N/A",
      sub: "dias de cobertura actual",
      icon: Calendar,
      text: SEMAFORO_STYLES[diasSemaforo].text,
      bg: SEMAFORO_STYLES[diasSemaforo].bg,
    },
    {
      label: "Sell-Through",
      value: totales.sell_through_pct != null ? `${totales.sell_through_pct}%` : "N/A",
      sub: "del inventario vendido",
      icon: Percent,
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Venta Diaria",
      value: `${totales.venta_diaria}`,
      sub: "unidades por dia",
      icon: ShoppingCart,
      text: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/40",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <Card key={c.label} className="hover-lift" style={{ animationDelay: `${i * 75}ms` }}>
          <CardContent className="pt-6">
            <div className={cn("inline-flex items-center justify-center w-[40px] h-[40px] rounded-lg", c.bg)}>
              <c.icon className={cn("h-5 w-5", c.text)} />
            </div>
            <div className="mt-3">
              <p className={cn("text-3xl font-bold tracking-tight", c.text)}>{c.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
