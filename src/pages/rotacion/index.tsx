import { TrendingUp, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModuleInfoButton } from "@/components/ModuleInfoButton";
import { MODULE_INFO } from "@/lib/module-info";
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
          <div className="flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Rotacion de Inventario</h1>
              <ModuleInfoButton content={MODULE_INFO["/rotacion"]} />
            </div>
            <p className="text-sm text-muted-foreground">
              Analisis de rotacion por sede y capacidad de compra
            </p>
          </div>
        </div>
        {flow.phase === "done" && (
          <Button variant="outline" size="sm" className="press-effect" onClick={flow.reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nuevo calculo
          </Button>
        )}
      </div>

      {/* Config */}
      {(flow.phase === "idle" || flow.phase === "error") && (
        <div className="animate-fade-in">
          <ConfigSection onStart={flow.startCalculation} disabled={isProcessing} />
          {flow.error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{flow.error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div className="animate-fade-in">
          <ProcessingProgress
            backendPhase={flow.backendPhase}
            elapsedSeconds={flow.elapsedSeconds}
          />
        </div>
      )}

      {/* Results */}
      {flow.phase === "done" && flow.result && (
        <div className="space-y-6 animate-fade-in">
          <ResultsSummary totales={flow.result.totales} meses={flow.result.periodo_meses} />
          <SedeTable sedes={flow.result.sedes} totales={flow.result.totales} />
          <SedeChart sedes={flow.result.sedes} />
          <CapacityCalculator sedes={flow.result.sedes} />
        </div>
      )}
    </div>
  );
}
