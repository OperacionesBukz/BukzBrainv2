import { useState, useCallback } from "react";
import PlanetaStepIndicator from "./corte-planeta/PlanetaStepIndicator";
import PlanetaPhase1Bodegas from "./corte-planeta/PlanetaPhase1Bodegas";
import PlanetaPhase2Descuentos from "./corte-planeta/PlanetaPhase2Descuentos";
import PlanetaPhase3Correo from "./corte-planeta/PlanetaPhase3Correo";
import type { PlanetaPhase } from "./corte-planeta/types";

export default function CortePlaneta() {
  const [currentPhase, setCurrentPhase] = useState<PlanetaPhase>(1);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());

  const completePhase = useCallback((phase: PlanetaPhase) => {
    setCompletedPhases((prev) => new Set(prev).add(phase));
    if (phase < 3) {
      setCurrentPhase((phase + 1) as PlanetaPhase);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          Corte Planeta
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Procesamiento del corte mensual de Grupo Editorial Planeta
        </p>
      </div>

      <PlanetaStepIndicator
        currentPhase={currentPhase}
        onPhaseClick={setCurrentPhase}
        completedPhases={completedPhases}
      />

      <div className="rounded-lg border bg-card p-6">
        {currentPhase === 1 && (
          <PlanetaPhase1Bodegas onComplete={() => completePhase(1)} />
        )}
        {currentPhase === 2 && (
          <PlanetaPhase2Descuentos onComplete={() => completePhase(2)} />
        )}
        {currentPhase === 3 && (
          <PlanetaPhase3Correo onComplete={() => completePhase(3)} />
        )}
      </div>
    </div>
  );
}
