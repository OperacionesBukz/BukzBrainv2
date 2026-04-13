import { TrendingUp, Calendar, Percent, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCountUp } from "../useCountUp";
import type { TurnoverTotals } from "../types";

interface ResultsSummaryProps {
  totales: TurnoverTotals;
  meses: number;
}

const SEMAFORO_STYLES = {
  verde: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    label: "Buena",
  },
  amarillo: {
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    label: "Regular",
  },
  rojo: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Baja",
  },
};

function AnimatedValue({ end, decimals = 0, suffix = "" }: { end: number; decimals?: number; suffix?: string }) {
  const val = useCountUp(end, 1200, decimals);
  return <>{val}{suffix}</>;
}

export default function ResultsSummary({ totales, meses }: ResultsSummaryProps) {
  const diasSemaforo =
    totales.dias_inventario != null && totales.dias_inventario <= 120
      ? "verde"
      : totales.dias_inventario != null && totales.dias_inventario <= 180
        ? "amarillo"
        : "rojo";

  const semaforoStyle = SEMAFORO_STYLES[totales.semaforo] ?? SEMAFORO_STYLES.rojo;

  return (
    <div className="space-y-4">
      {/* Hero metric: Rotacion */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 p-6 sm:p-8">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/15 dark:via-primary/5" />
        <div className="absolute inset-0 bg-dot-pattern opacity-20 dark:opacity-10" />
        {/* Watermark icon */}
        <TrendingUp className="absolute right-4 top-1/2 -translate-y-1/2 h-28 w-28 sm:h-36 sm:w-36 text-primary/[0.07] dark:text-primary/[0.05]" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/15">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rotacion Total</p>
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-6xl sm:text-7xl font-bold tracking-tighter text-primary">
                {totales.rotacion != null ? <AnimatedValue end={totales.rotacion * 100} decimals={0} suffix="%" /> : "N/A"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              en {meses} meses de analisis
            </p>
          </div>

          <Badge
            variant="outline"
            className={cn("text-sm font-semibold px-3 py-1 rounded-full", semaforoStyle.badge)}
          >
            {semaforoStyle.label}
          </Badge>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {/* Dias de Inventario */}
        <div className={cn(
          "rounded-xl bg-card/80 backdrop-blur-sm border-l-4 p-5 hover:shadow-md transition-all duration-300",
          SEMAFORO_STYLES[diasSemaforo].text.includes("green")
            ? "border-l-green-500"
            : SEMAFORO_STYLES[diasSemaforo].text.includes("yellow")
              ? "border-l-yellow-500"
              : "border-l-red-500",
        )}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className={cn("h-4 w-4", SEMAFORO_STYLES[diasSemaforo].text)} />
            <p className="text-sm font-medium text-muted-foreground">Dias de Inventario</p>
          </div>
          <p className={cn("text-3xl font-bold tracking-tight", SEMAFORO_STYLES[diasSemaforo].text)}>
            {totales.dias_inventario != null ? <AnimatedValue end={totales.dias_inventario} /> : "N/A"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">dias de cobertura actual</p>
        </div>

        {/* Sell-Through */}
        <div className="rounded-xl bg-card/80 backdrop-blur-sm border-l-4 border-l-blue-500 p-5 hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <Percent className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-muted-foreground">Sell-Through</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {totales.sell_through_pct != null ? <AnimatedValue end={totales.sell_through_pct} decimals={1} suffix="%" /> : "N/A"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">del inventario vendido</p>
        </div>

        {/* Venta Diaria */}
        <div className="rounded-xl bg-card/80 backdrop-blur-sm border-l-4 border-l-green-500 p-5 hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-4 w-4 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-muted-foreground">Venta Diaria</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
            <AnimatedValue end={totales.venta_diaria} />
          </p>
          <p className="text-xs text-muted-foreground mt-1">unidades por dia</p>
        </div>
      </div>
    </div>
  );
}
