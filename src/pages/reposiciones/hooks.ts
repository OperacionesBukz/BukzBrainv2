import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import {
  getLocations,
  getVendors,
  getSalesStatus,
  refreshSales,
  calculateReplenishment,
  approveDraft,
  generateOrders,
  exportOrdersZip,
  markOrderSent,
  downloadZipFromBase64,
  getOrderDetail,
  transitionOrderStatus,
  exportSingleOrder,
  downloadExcelFromBase64,
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
    mutationFn: (params: CalculateRequest) => calculateReplenishment(params),
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
  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Use ref to avoid stale closure in polling effect
  const pendingRequestRef = useRef<CalculateRequest | null>(null);

  const pollingQuery = useSalesStatusPolling(isPolling);
  const calculateMutation = useCalculate();

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
      setIsCalculating(true);
      calculateMutation.mutate(request, {
        onSuccess: (res) => {
          setResults(res);
          setIsCalculating(false);
          toast.success("Calculo completado");
        },
        onError: (err: Error) => {
          setError(err.message);
          setIsCalculating(false);
          toast.error(err.message);
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingQuery.data, isPolling]);

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

    // 2. If cache is fresh, calculate directly
    if (status.status === "completed" && isCacheFresh(status.last_refreshed)) {
      setIsCalculating(true);
      calculateMutation.mutate(request, {
        onSuccess: (res) => {
          setResults(res);
          setIsCalculating(false);
          toast.success("Calculo completado");
        },
        onError: (err: Error) => {
          setError(err.message);
          setIsCalculating(false);
          toast.error(err.message);
        },
      });
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

      // D-06: 409 OPERATION_IN_PROGRESS specific message
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
    pendingRequestRef.current = null;
  }

  return {
    isPolling,
    isCalculating,
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
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    // Base query: all non-borrador orders
    const q = query(
      collection(db, "replenishment_orders"),
      where("status", "in", ["aprobado", "enviado", "parcial", "recibido"])
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data();
          return {
            order_id: d.id,
            vendor: data.vendor ?? "",
            status: data.status,
            item_count: Array.isArray(data.items) ? data.items.length : 0,
            created_by: data.created_by ?? "",
            created_at: data.created_at ?? "",
            status_history: data.status_history ?? [],
          } as OrderListItem;
        });

        // Store ALL non-borrador orders — filtering happens in useMemo below
        setOrders(docs);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsub();
    // Firestore query never changes — client-side filters applied in useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters and sort via useMemo to avoid re-creating the Firestore listener
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filters.vendor) {
      result = result.filter((o) => o.vendor === filters.vendor);
    }
    if (filters.status) {
      result = result.filter((o) => o.status === filters.status);
    }
    if (filters.dateFrom) {
      result = result.filter((o) => o.created_at >= filters.dateFrom);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setDate(toDate.getDate() + 1);
      result = result.filter((o) => o.created_at < toDate.toISOString());
    }
    // Default sort: created_at descending (per D-05)
    result.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    return result;
  }, [orders, filters.vendor, filters.status, filters.dateFrom, filters.dateTo]);

  return { orders: filteredOrders, isLoading, error };
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
