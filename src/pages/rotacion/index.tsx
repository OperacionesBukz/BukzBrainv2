import { TrendingUp, RotateCcw, AlertCircle, CalendarDays, Clock } from "lucide-react";
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
  const isDone = flow.phase === "done" && flow.result;

  return (
    <div className="space-y-6">
      {/* Header with atmospheric hero zone */}
      <div className={
        isDone
          ? "relative -mx-4 -mt-2 px-4 pt-4 pb-6 rounded-b-2xl overflow-hidden"
          : ""
      }>
        {/* Background texture for done state */}
        {isDone && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent dark:from-primary/10" />
            <div className="absolute inset-0 bg-dot-pattern opacity-30 dark:opacity-15" />
          </>
        )}

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tighter">Rotacion de Inventario</h1>
                <ModuleInfoButton content={MODULE_INFO["/rotacion"]} />
              </div>
              <p className="text-sm text-muted-foreground">
                Analisis de rotacion por sede y capacidad de compra
              </p>
              <div className="h-[3px] w-12 bg-primary rounded-full mt-1.5" />

              {/* Contextual metadata badges when results are shown */}
              {isDone && flow.result && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono bg-muted/80 dark:bg-muted/50 px-2.5 py-1 rounded-md text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(flow.result.fecha_calculo).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono bg-primary/10 px-2.5 py-1 rounded-md text-primary font-semibold">
                    <CalendarDays className="h-3 w-3" />
                    {flow.result.periodo_meses}M
                  </span>
                </div>
              )}
            </div>
          </div>
          {isDone && (
            <Button variant="outline" size="sm" className="press-effect" onClick={flow.reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Nuevo calculo
            </Button>
          )}
        </div>
      </div>

      {/* Config */}
      {(flow.phase === "idle" || flow.phase === "error") && (
        <div className="animate-fade-in-scale">
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
        <div className="animate-fade-in-scale">
          <ProcessingProgress
            backendPhase={flow.backendPhase}
            elapsedSeconds={flow.elapsedSeconds}
          />
        </div>
      )}

      {/* Results - staggered reveal */}
      {isDone && flow.result && (
        <div className="space-y-6">
          <div className="animate-fade-in opacity-0" style={{ animationDelay: "0ms" }}>
            <ResultsSummary totales={flow.result.totales} meses={flow.result.periodo_meses} />
          </div>
          <div className="animate-fade-in opacity-0" style={{ animationDelay: "120ms" }}>
            <SedeTable sedes={flow.result.sedes} totales={flow.result.totales} />
          </div>
          <div className="animate-fade-in opacity-0" style={{ animationDelay: "240ms" }}>
            <SedeChart sedes={flow.result.sedes} />
          </div>
          <div className="animate-fade-in opacity-0" style={{ animationDelay: "360ms" }}>
            <CapacityCalculator sedes={flow.result.sedes} />
          </div>
        </div>
      )}
    </div>
  );
}
