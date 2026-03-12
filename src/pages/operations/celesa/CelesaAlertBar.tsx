import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CelesaOrder } from "./types";

interface CelesaAlertBarProps {
  orders: CelesaOrder[];
}

export default function CelesaAlertBar({ orders }: CelesaAlertBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const atrasados = orders.filter((o) => o.estado === "Atrasado");

  if (dismissed || atrasados.length === 0) return null;

  return (
    <Alert variant="destructive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="pr-8">
        {atrasados.length === 1
          ? `Hay 1 pedido atrasado que requiere atención.`
          : `Hay ${atrasados.length} pedidos atrasados que requieren atención.`}
      </AlertDescription>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-destructive-foreground/70 hover:text-destructive-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}
