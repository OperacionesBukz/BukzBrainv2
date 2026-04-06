import { TrendingUp } from "lucide-react";

export default function Rotacion() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rotación de Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Módulo en construcción
          </p>
        </div>
      </div>
    </div>
  );
}
