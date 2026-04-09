import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProcessingProgressProps {
  backendPhase: string | null;
  elapsedSeconds: number;
}

const STEPS = [
  { key: "locations", label: "Conectando con Shopify", detail: "Obteniendo ubicaciones" },
  { key: "sales", label: "Obteniendo ventas", detail: "Consultando datos de Shopify" },
  { key: "processing", label: "Calculando metricas", detail: "Procesando rotacion por sede" },
];

export default function ProcessingProgress({
  backendPhase,
  elapsedSeconds,
}: ProcessingProgressProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === backendPhase);
  const progressPct = currentIdx === -1 ? 0 : Math.round(((currentIdx + 0.5) / STEPS.length) * 100);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
  };

  return (
    <Card className="max-w-[480px] mx-auto">
      <CardContent className="py-8 px-6">
        {/* Progress bar */}
        <div className="h-[6px] rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Steps timeline */}
        <div className="mt-8 space-y-0">
          {STEPS.map((step, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            const isLast = i === STEPS.length - 1;

            return (
              <div key={step.key} className="flex gap-3">
                {/* Timeline column */}
                <div className="flex flex-col items-center">
                  {isDone ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                  ) : isActive ? (
                    <div className="animate-subtle-pulse">
                      <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-muted shrink-0" />
                  )}
                  {!isLast && (
                    <div className={cn(
                      "w-[2px] h-[32px]",
                      isDone ? "bg-green-600 dark:bg-green-400" : "bg-muted"
                    )} />
                  )}
                </div>

                {/* Content */}
                <div className="pb-6">
                  <p className={cn(
                    "text-sm font-medium",
                    isDone && "text-green-600 dark:text-green-400",
                    isActive && "text-foreground",
                    !isDone && !isActive && "text-muted-foreground",
                  )}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timer */}
        <div className="text-center mt-2">
          <p className="text-lg font-mono font-semibold text-primary">
            {formatTime(elapsedSeconds)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Tiempo transcurrido</p>
        </div>
      </CardContent>
    </Card>
  );
}
