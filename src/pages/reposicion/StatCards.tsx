import { Card } from "@/components/ui/card";
import { BookOpen, ClipboardList, AlertTriangle, XCircle, Factory } from "lucide-react";
import type { ReplenishmentStats } from "./types";

interface StatCardsProps {
  stats: ReplenishmentStats;
}

const statConfig = [
  { key: "totalProducts" as const, label: "Productos Activos", Icon: BookOpen, variant: "default" },
  { key: "needReplenishment" as const, label: "Necesitan Reposición", Icon: ClipboardList, variant: "warning" },
  { key: "urgent" as const, label: "Urgentes", Icon: AlertTriangle, variant: "destructive" },
  { key: "outOfStock" as const, label: "Agotados (Stock 0)", Icon: XCircle, variant: "destructive" },
  { key: "vendorsWithOrders" as const, label: "Proveedores con Pedido", Icon: Factory, variant: "success" },
];

const variantClasses: Record<string, string> = {
  default: "text-primary",
  warning: "text-amber-500",
  destructive: "text-destructive",
  success: "text-emerald-500",
};

export default function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {statConfig.map(({ key, label, Icon, variant }) => (
        <Card key={key} className="p-4 text-center">
          <Icon className={`h-5 w-5 mx-auto mb-1 ${variantClasses[variant]}`} />
          <div className={`text-2xl font-bold font-mono ${variantClasses[variant]}`}>
            {stats[key].toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </Card>
      ))}
    </div>
  );
}
