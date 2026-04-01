import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DollarSign, Package } from "lucide-react";
import type { CmvTotals } from "../types";

/** Formatea valores grandes: >= 1M como "$XXX.XM", >= 1000 con separadores */
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions.toFixed(1)}M`;
  }
  return `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

interface SummaryCardsProps {
  totals: CmvTotals;
}

const cards = [
  {
    key: "ventas",
    label: "Total Ventas",
    icon: DollarSign,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    getValue: (t: CmvTotals) => formatCurrency(t.totalVentas),
  },
  {
    key: "productos",
    label: "Total Productos",
    icon: Package,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    getValue: (t: CmvTotals) => t.totalProductos.toLocaleString("es-CO"),
  },
] as const;

export function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className={cn("rounded-lg p-2", card.bg)}>
                  <Icon className={cn("h-5 w-5", card.color)} />
                </div>
              </div>
              <div className="mt-4">
                <p className={cn("text-2xl font-bold tracking-tight", card.color)}>
                  {card.getValue(totals)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {card.label}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
