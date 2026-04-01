import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ExceptionsPanel from "./ExceptionsPanel";
import type { ProcessingStats, CmvProduct, Vendor } from "../types";

interface ProcessingStepProps {
  stats: ProcessingStats;
  unknownVendorProducts: CmvProduct[];
  vendors: Vendor[];
  onResolveVendor: (isbn: string, vendorName: string) => void;
  onFinishReview: () => void;
  onBack: () => void;
}

export default function ProcessingStep({
  stats,
  unknownVendorProducts,
  vendors,
  onResolveVendor,
  onFinishReview,
  onBack,
}: ProcessingStepProps) {
  const hasExceptions = unknownVendorProducts.length > 0;

  return (
    <div className="space-y-6">
      {/* Resumen de procesamiento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Resumen del procesamiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatItem
              label="Total registros crudos"
              value={stats.totalRawRecords}
            />
            <StatItem
              label="Eliminados por notas crédito"
              value={stats.removedByNotes}
              variant="destructive"
            />
            <StatItem
              label="Eliminados formas de pago"
              value={stats.removedPayments}
              variant="destructive"
            />
            <StatItem
              label="Eliminados servicios"
              value={stats.removedServices}
              variant="destructive"
            />
            <StatItem
              label="Productos finales"
              value={stats.totalProducts}
              variant="success"
            />
          </div>
        </CardContent>
      </Card>

      {/* Panel de excepciones (si las hay) */}
      {hasExceptions && (
        <ExceptionsPanel
          unknownVendorProducts={unknownVendorProducts}
          vendors={vendors}
          onResolveVendor={onResolveVendor}
        />
      )}

      {/* Botones de navegación */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>

        <div className="flex gap-2">
          {hasExceptions && (
            <Button variant="secondary" onClick={onFinishReview}>
              Continuar con excepciones
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {!hasExceptions && (
            <Button onClick={onFinishReview}>
              Ver Resultados
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Componente auxiliar para cada estadística */
function StatItem({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "destructive" | "success";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge
        variant={variant === "destructive" ? "destructive" : "secondary"}
        className={
          variant === "success"
            ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25"
            : undefined
        }
      >
        {value.toLocaleString("es-CO")}
      </Badge>
    </div>
  );
}
