import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProcessingProgressProps {
  backendPhase: string | null;
  elapsedSeconds: number;
}

const STEPS = [
  { key: "locations", label: "Conectando con Shopify" },
  { key: "sales", label: "Obteniendo ventas de Shopify" },
  { key: "processing", label: "Calculando metricas" },
];

export default function ProcessingProgress({
  backendPhase,
  elapsedSeconds,
}: ProcessingProgressProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === backendPhase);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <Card>
      <CardContent className="py-6">
        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const isDone = i < currentIdx || (backendPhase === null && currentIdx === -1);
            const isActive = i === currentIdx;

            return (
              <div key={step.key} className="flex items-center gap-3">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    isDone && "text-green-600",
                    isActive && "font-medium",
                    !isDone && !isActive && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground mt-2">
            Tiempo transcurrido: {formatTime(elapsedSeconds)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
