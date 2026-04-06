import { TrendingUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTurnoverFlow } from "./hooks";
import ConfigSection from "./components/ConfigSection";
import ProcessingProgress from "./components/ProcessingProgress";
import ResultsSummary from "./components/ResultsSummary";
import SedeTable from "./components/SedeTable";
import SedeChart from "./components/SedeChart";
import CapacityCalculator from "./components/CapacityCalculator";

export default function Rotacion() {
  const flow = useTurnoverFlow();

  const isProcessing = flow.phase === "uploading" || flow.phase === "processing";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rotacion de Inventario</h1>
            <p className="text-sm text-muted-foreground">
              Analisis de rotacion por sede y capacidad de compra
            </p>
          </div>
        </div>
        {flow.phase === "done" && (
          <Button variant="outline" size="sm" onClick={flow.reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nuevo calculo
          </Button>
        )}
      </div>

      {/* Section 1: Configuration */}
      {(flow.phase === "idle" || flow.phase === "error") && (
        <>
          <ConfigSection onStart={flow.startCalculation} disabled={isProcessing} />
          {flow.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{flow.error}</p>
            </div>
          )}
        </>
      )}

      {/* Section 2: Processing */}
      {isProcessing && (
        <ProcessingProgress
          backendPhase={flow.backendPhase}
          elapsedSeconds={flow.elapsedSeconds}
        />
      )}

      {/* Section 3: Results */}
      {flow.phase === "done" && flow.result && (
        <>
          <ResultsSummary totales={flow.result.totales} meses={flow.result.periodo_meses} />
          <SedeTable sedes={flow.result.sedes} totales={flow.result.totales} />
          <SedeChart sedes={flow.result.sedes} />

          {/* Section 4: Capacity Calculator */}
          <CapacityCalculator sedes={flow.result.sedes} />
        </>
      )}
    </div>
  );
}
