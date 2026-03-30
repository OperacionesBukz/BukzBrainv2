import { useQuery, useMutation } from "@tanstack/react-query";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getLocations,
  getVendors,
  getSalesStatus,
  calculateReplenishment,
} from "./api";
import type { ReplenishmentConfig, CalculateRequest } from "./types";

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
