import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import {
  getLocations,
  getVendors,
  getSalesStatus,
  refreshSales,
  startCalculation as apiStartCalculation,
  getCalculationStatus,
  approveDraft,
  generateOrders,
  exportOrdersZip,
  markOrderSent,
  downloadZipFromBase64,
  getOrderDetail,
  transitionOrderStatus,
  exportSingleOrder,
  downloadExcelFromBase64,
  getOrderList,
  deleteOrder,
} from "./api";
import type {
  ReplenishmentConfig,
  CalculateRequest,
  CalculateResponse,
  SalesStatusResponse,
  ApproveRequest,
  GenerateOrdersRequest,
  ExportOrdersRequest,
  OrderListItem,
  OrderHistoryFilters,
  StatusTransitionRequest,
  SingleExportResponse,
} from "./types";

export function useLocations() {
  return useQuery({
    queryKey: ["reposiciones", "locations"],
    queryFn: getLocations,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["reposiciones", "vendors"],
    queryFn: getVendors,
    staleTime: 10 * 60 * 1000,
    retry: 2,
    // If backend returns empty (cache building), poll every 5s until vendors arrive
    refetchInterval: (query) => {
      const data = query.state.data;
      if (Array.isArray(data) && data.length === 0) return 5000;
      return false;
    },
  });
}

export function useSalesStatusPolling(enabled: boolean) {
  return useQuery({
    queryKey: ["reposiciones", "sales", "status"],
    queryFn: getSalesStatus,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (enabled && (data?.status === "running" || !data)) {
        return 3000;
      }
      return false;
    },
  });
}

export function useCalculate() {
  return useMutation({
    mutationFn: (params: CalculateRequest) => apiStartCalculation(params),
  });
}

export function useReplenishmentConfig(uid: string | undefined) {
  return useQuery({
    queryKey: ["reposiciones", "config", uid],
    queryFn: async () => {
      if (!uid) return null;
      const snap = await getDoc(doc(db, "replenishment_config", uid));
      if (!snap.exists()) return null;
      return snap.data() as ReplenishmentConfig;
    },
    enabled: !!uid,
    staleTime: Infinity,
  });
}

export async function saveReplenishmentConfig(
  uid: string,
  config: ReplenishmentConfig
): Promise<void> {
  await setDoc(doc(db, "replenishment_config", uid), {
    ...config,
    updated_at: serverTimestamp(),
  });
}

// --- useCalculationFlow ---

interface CalculationFlowState {
  isPolling: boolean;
  isCalculating: boolean;
  calcStep: string;
  calcProgress: number;
  salesStatus: SalesStatusResponse | null;
  results: CalculateResponse | null;
  error: string | null;
}

const CACHE_FRESHNESS_MS = 24 * 60 * 60 * 1000; // 24 hours

function isCacheFresh(lastRefreshed: string | undefined): boolean {
  if (!lastRefreshed) return false;
  const refreshTime = new Date(lastRefreshed).getTime();
  return Date.now() - refreshTime < CACHE_FRESHNESS_MS;
}

export function useCalculationFlow(): CalculationFlowState & {
  startCalculation: (request: CalculateRequest) => Promise<void>;
  resetResults: () => void;
} {
  const [isPolling, setIsPolling] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcStep, setCalcStep] = useState("starting");
  const [calcProgress, setCalcProgress] = useState(0);
  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRequestRef = useRef<CalculateRequest | null>(null);
  const calcJobIdRef = useRef<string | null>(null);
  const calcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollingQuery = useSalesStatusPolling(isPolling);

  // Watch polling status — when completed, trigger calculation
  useEffect(() => {
    const data = pollingQuery.data;
    if (
      isPolling &&
      data?.status === "completed" &&
      pendingRequestRef.current
    ) {
      const request = pendingRequestRef.current;
      pendingRequestRef.current = null;
      setIsPolling(false);
      _launchCalcJob(request);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingQuery.data, isPolling]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (calcPollRef.current) clearInterval(calcPollRef.current);
    };
  }, []);

  async function _launchCalcJob(request: CalculateRequest) {
    setIsCalculating(true);
    setCalcStep("starting");
    setCalcProgress(0);
    try {
      const { job_id } = await apiStartCalculation(request);
      calcJobIdRef.current = job_id;
      // Poll every 2 seconds
      calcPollRef.current = setInterval(async () => {
        try {
          const res = await getCalculationStatus(job_id);
          if ("status" in res && res.status === "running") {
            setCalcStep((res as { step: string }).step || "starting");
            setCalcProgress((res as { progress: number }).progress || 0);
          } else {
            // Completed — res is CalculateResponse
            if (calcPollRef.current) clearInterval(calcPollRef.current);
            calcPollRef.current = null;
            calcJobIdRef.current = null;
            setResults(res as CalculateResponse);
            setIsCalculating(false);
            setCalcStep("done");
            setCalcProgress(100);
            toast.success("Calculo completado");
          }
        } catch (err) {
          if (calcPollRef.current) clearInterval(calcPollRef.current);
          calcPollRef.current = null;
          calcJobIdRef.current = null;
          const msg = err instanceof Error ? err.message : "Error en cálculo";
          setError(msg);
          setIsCalculating(false);
          toast.error(msg);
        }
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error iniciando cálculo";
      setError(msg);
      setIsCalculating(false);
      toast.error(msg);
    }
  }

  async function startCalculation(request: CalculateRequest): Promise<void> {
    setError(null);

    // 1. Check sales cache status
    let status: SalesStatusResponse;
    try {
      status = await getSalesStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al verificar estado de ventas";
      setError(msg);
      toast.error(msg);
      return;
    }

    // 2. If cache is fresh, calculate directly (async job)
    if (status.status === "completed" && isCacheFresh(status.last_refreshed)) {
      await _launchCalcJob(request);
      return;
    }

    // 3. Cache stale/missing — trigger refresh + start polling
    try {
      toast.info("Actualizando datos de ventas...");
      await refreshSales(request.date_range_days);
      pendingRequestRef.current = request;
      setIsPolling(true);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error al actualizar ventas";

      if (errMsg.includes("Bulk") || errMsg.includes("operacion") || errMsg.includes("OPERATION_IN_PROGRESS")) {
        toast.error("Hay una operacion Bulk en curso en Shopify. Intenta en unos minutos.");
        setError("Hay una operacion Bulk en curso en Shopify. Intenta en unos minutos.");
      } else {
        toast.error(errMsg);
        setError(errMsg);
      }
    }
  }

  function resetResults() {
    setResults(null);
    setError(null);
    setIsPolling(false);
    setIsCalculating(false);
    setCalcStep("starting");
    setCalcProgress(0);
    if (calcPollRef.current) clearInterval(calcPollRef.current);
    calcPollRef.current = null;
    calcJobIdRef.current = null;
    pendingRequestRef.current = null;
  }

  return {
    isPolling,
    isCalculating,
    calcStep,
    calcProgress,
    salesStatus: pollingQuery.data ?? null,
    results,
    error,
    startCalculation,
    resetResults,
  };
}

// ─── Phase 7: Approval, Orders, Export mutations ───────────────────────────

export function useApprove() {
  return useMutation({
    mutationFn: (params: ApproveRequest) => approveDraft(params),
    onError: (err: Error) => {
      toast.error(err.message || "Error al aprobar el sugerido");
    },
  });
}

export function useGenerateOrders() {
  return useMutation({
    mutationFn: (params: GenerateOrdersRequest) => generateOrders(params),
    onError: (err: Error) => {
      toast.error(err.message || "Error generando pedidos");
    },
  });
}

export function useExportZip() {
  return useMutation({
    mutationFn: (params: ExportOrdersRequest) => exportOrdersZip(params),
    onSuccess: (data) => {
      downloadZipFromBase64(data.zip_base64, data.filename);
      toast.success("ZIP descargado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error generando el ZIP");
    },
  });
}

export function useMarkSent() {
  return useMutation({
    mutationFn: ({ orderId, sentBy }: { orderId: string; sentBy: string }) =>
      markOrderSent(orderId, sentBy),
    onError: (err: Error) => {
      toast.error(err.message || "Error marcando pedido como enviado");
    },
  });
}

// ─── Phase 8: Order History hooks ────────────────────────────────────────

export function useOrderHistory(filters: OrderHistoryFilters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reposiciones", "order-history", filters.vendor, filters.status, filters.dateFrom, filters.dateTo],
    queryFn: () =>
      getOrderList({
        vendor: filters.vendor || undefined,
        status: filters.status || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      }),
    staleTime: 30_000,
  });

  return {
    orders: data?.orders ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
  };
}

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ["reposiciones", "order-detail", orderId],
    queryFn: () => getOrderDetail(orderId!),
    enabled: !!orderId,
    staleTime: 30_000,
  });
}

export function useStatusTransition() {
  return useMutation({
    mutationFn: ({
      orderId,
      status,
      changedBy,
    }: {
      orderId: string;
      status: string;
      changedBy: string;
    }) => transitionOrderStatus(orderId, { status, changed_by: changedBy }),
    onError: (err: Error) => {
      toast.error(err.message || "Error en la transicion de estado");
    },
  });
}

export function useExportSingleOrder() {
  return useMutation({
    mutationFn: (orderId: string) => exportSingleOrder(orderId),
    onSuccess: (data: SingleExportResponse) => {
      downloadExcelFromBase64(data.excel_base64, data.filename);
      toast.success("Excel descargado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error descargando Excel");
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => deleteOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reposiciones", "order-history"] });
      toast.success("Pedido eliminado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al eliminar pedido");
    },
  });
}
