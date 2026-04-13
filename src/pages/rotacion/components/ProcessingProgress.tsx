import { CheckCircle2, Loader2 } from "lucide-react";
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
  const progressPct = currentIdx === -1 ? 10 : Math.round(((currentIdx + 0.5) / STEPS.length) * 100);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
  };

  return (
    <div className="relative max-w-[480px] mx-auto overflow-hidden rounded-2xl border border-border/50 bg-card">
      {/* Background texture */}
      <div className="absolute inset-0 bg-dot-pattern opacity-20 dark:opacity-10" />

      <div className="relative py-8 px-6">
        {/* Orbital visualization */}
        <div className="relative w-[120px] h-[120px] mx-auto mb-8">
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-pulse-ring" />
          {/* Static outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
          {/* Orbiting dots */}
          <div
            className="absolute w-3 h-3 rounded-full bg-primary animate-orbit"
            style={{ top: "50%", left: "50%", marginTop: "-6px", marginLeft: "-6px" }}
          />
          <div
            className="absolute w-2 h-2 rounded-full bg-primary/50 animate-orbit-reverse"
            style={{ top: "50%", left: "50%", marginTop: "-4px", marginLeft: "-4px" }}
          />
          {/* Center content */}
          <div className="absolute inset-[20px] rounded-full border-2 border-primary/30 bg-card/80 backdrop-blur-sm flex items-center justify-center">
            <span className="text-2xl font-bold font-mono text-primary">{progressPct}%</span>
          </div>
        </div>

        {/* Steps timeline */}
        <div className="space-y-0">
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
                      "w-[2px] h-[28px]",
                      isDone ? "bg-green-600 dark:bg-green-400" : "bg-muted"
                    )} />
                  )}
                </div>

                {/* Content */}
                <div className={cn(
                  "pb-5 -mt-0.5 px-3 py-2 rounded-lg transition-colors",
                  isActive && "bg-primary/5 dark:bg-primary/10",
                )}>
                  <p className={cn(
                    "text-sm font-medium",
                    isDone && "text-green-600 dark:text-green-400",
                    isActive && "text-foreground font-semibold",
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
        <div className="text-center border-t border-border/50 pt-4 mt-2">
          <p className="text-2xl font-mono font-bold tracking-wider text-primary">
            {formatTime(elapsedSeconds)}
          </p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">
            Tiempo transcurrido
          </p>
        </div>
      </div>
    </div>
  );
}
