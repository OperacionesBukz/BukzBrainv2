import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingDown, Percent } from "lucide-react";
import type { CmvTotals } from "../types";

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

interface SummaryCardsProps {
  totals: CmvTotals;
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  const hasCostData = totals.totalCosto > 0;

  return (
    <div className={cn(
      "grid gap-4 grid-cols-1",
      hasCostData ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"
    )}>
      <SummaryCard
        icon={DollarSign}
        label="Total Ventas"
        value={formatCurrency(totals.totalVentas)}
        color="text-green-600 dark:text-green-400"
        bg="bg-green-50 dark:bg-green-950/40"
      />
      <SummaryCard
        icon={Percent}
        label="% Costo / Ventas"
        value={`${totals.costoPctVentas.toFixed(1)}%`}
        color="text-blue-600 dark:text-blue-400"
        bg="bg-blue-50 dark:bg-blue-950/40"
      />
      {hasCostData && (
        <>
          <SummaryCard
            icon={TrendingDown}
            label="Total Costo"
            value={formatCurrency(totals.totalCosto)}
            color="text-red-600 dark:text-red-400"
            bg="bg-red-50 dark:bg-red-950/40"
          />
          <SummaryCard
            icon={Percent}
            label="Margen Promedio"
            value={`${totals.margenPromedio.toFixed(1)}%`}
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-50 dark:bg-amber-950/40"
          />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className={cn("rounded-lg p-2", bg)}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
        <div className="mt-4">
          <p className={cn("text-2xl font-bold tracking-tight", color)}>
            {value}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
