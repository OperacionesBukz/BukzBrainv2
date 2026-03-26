import { Check } from "lucide-react";
import type { PlanetaPhase } from "./types";

interface Props {
  currentPhase: PlanetaPhase;
  onPhaseClick: (phase: PlanetaPhase) => void;
  completedPhases: Set<number>;
}

const STEPS: { phase: PlanetaPhase; label: string }[] = [
  { phase: 1, label: "Bodegas" },
  { phase: 2, label: "Descuentos" },
  { phase: 3, label: "Enviar Correo" },
];

export default function PlanetaStepIndicator({ currentPhase, onPhaseClick, completedPhases }: Props) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map(({ phase, label }, i) => {
        const isCompleted = completedPhases.has(phase);
        const isActive = phase === currentPhase;
        const canClick = isCompleted || phase < currentPhase;

        return (
          <div key={phase} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-px w-8 md:w-12 ${isCompleted || isActive ? "bg-primary" : "bg-border"}`} />
            )}
            <button
              onClick={() => canClick && onPhaseClick(phase)}
              disabled={!canClick}
              className={`
                flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${isActive ? "bg-primary/10 text-primary border border-primary/30" : ""}
                ${isCompleted && !isActive ? "text-muted-foreground hover:text-foreground cursor-pointer" : ""}
                ${!isCompleted && !isActive ? "text-muted-foreground/50 cursor-not-allowed" : ""}
              `}
            >
              <span className={`
                flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                ${isActive ? "bg-primary text-primary-foreground" : ""}
                ${isCompleted && !isActive ? "bg-primary/20 text-primary" : ""}
                ${!isCompleted && !isActive ? "bg-muted text-muted-foreground/50" : ""}
              `}>
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : phase}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
