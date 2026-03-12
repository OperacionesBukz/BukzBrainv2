import { Package, CheckCircle2, Truck, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CelesaOrder } from "./types";

interface CelesaKpiCardsProps {
  orders: CelesaOrder[];
}

export default function CelesaKpiCards({ orders }: CelesaKpiCardsProps) {
  const total = orders.length;
  const entregados = orders.filter((o) => o.estado === "Entregado").length;
  const enTransito = orders.filter(
    (o) => o.estado === "Confirmado"
  ).length;
  const atrasados = orders.filter((o) => o.estado === "Atrasado").length;

  const cards = [
    {
      label: "Total Pedidos",
      value: total,
      icon: Package,
      color: "text-foreground",
    },
    {
      label: "Entregados",
      value: entregados,
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-400",
    },
    {
      label: "En Tránsito",
      value: enTransito,
      icon: Truck,
      color: "text-yellow-600 dark:text-yellow-400",
    },
    {
      label: "Atrasados",
      value: atrasados,
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <c.icon className={`h-5 w-5 shrink-0 ${c.color}`} />
            <div>
              <p className="text-2xl font-bold leading-none">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
