import { useState, useRef, useCallback, useEffect } from "react";
import { startDeadStockAnalysis, getDeadStockStatus } from "./api";
import type { DeadStockConfig, DeadStockResult } from "./types";

type Phase = "idle" | "processing" | "done" | "error";

interface DeadStockFlowState {
  phase: Phase;
  result: DeadStockResult | null;
  error: string | null;
  backendPhase: string | null;
  elapsedSeconds: number;
}

export function useDeadStockFlow() {
  const [state, setState] = useState<DeadStockFlowState>({
    phase: "idle",
    result: null,
    error: null,
    backendPhase: null,
    elapsedSeconds: 0,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const startAnalysis = useCallback(
    async (config: DeadStockConfig) => {
      stopPolling();
      setState({
        phase: "processing",
        result: null,
        error: null,
        backendPhase: "products",
        elapsedSeconds: 0,
      });

      try {
        const resp = await startDeadStockAnalysis(config);
        if (!resp.success) {
          setState((s) => ({
            ...s,
            phase: "error",
            error: resp.error ?? "Error desconocido",
          }));
          return;
        }

        // Timer for elapsed seconds
        const startTime = Date.now();
        timerRef.current = setInterval(() => {
          setState((s) => ({
            ...s,
            elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
          }));
        }, 1000);

        // Poll backend every 2s
        pollRef.current = setInterval(async () => {
          try {
            const status = await getDeadStockStatus();
            if (status.error) {
              stopPolling();
              setState((s) => ({ ...s, phase: "error", error: status.error }));
              return;
            }
            if (!status.running && status.result) {
              stopPolling();
              setState((s) => ({
                ...s,
                phase: "done",
                result: status.result,
                backendPhase: null,
              }));
              return;
            }
            setState((s) => ({ ...s, backendPhase: status.phase }));
          } catch {
            // Ignore transient fetch errors during polling
          }
        }, 2000);
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "Error de conexion",
        }));
      }
    },
    [stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setState({
      phase: "idle",
      result: null,
      error: null,
      backendPhase: null,
      elapsedSeconds: 0,
    });
  }, [stopPolling]);

  return { ...state, startAnalysis, reset };
}
