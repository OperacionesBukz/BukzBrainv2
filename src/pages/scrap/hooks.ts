import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  healthCheck,
  enrich,
  getJobStatus,
  downloadResult,
  downloadCreacion,
  getVendors,
  getCacheStats,
  clearCache,
  downloadBlob,
} from "./api";

export function useScrapHealth() {
  return useQuery({
    queryKey: ["scrap", "health"],
    queryFn: healthCheck,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useEnrich() {
  return useMutation({
    mutationFn: ({ file, delay }: { file: File; delay: number }) =>
      enrich(file, delay),
  });
}

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["scrap", "status", jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status !== "processing") return false;
      return 2000;
    },
  });
}

export function useDownloadResult() {
  return useMutation({
    mutationFn: (jobId: string) => downloadResult(jobId),
    onSuccess: (blob) => {
      downloadBlob(blob, "libros_enriquecidos.xlsx");
    },
  });
}

export function useDownloadCreacion() {
  return useMutation({
    mutationFn: ({ jobId, vendor }: { jobId: string; vendor?: string }) =>
      downloadCreacion(jobId, vendor),
    onSuccess: (blob) => {
      downloadBlob(blob, "Creacion_productos.xlsx");
    },
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["scrap", "vendors"],
    queryFn: getVendors,
    staleTime: Infinity,
  });
}

export function useCacheStats() {
  return useQuery({
    queryKey: ["scrap", "cache", "stats"],
    queryFn: getCacheStats,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClearCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearCache,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scrap", "cache", "stats"] });
    },
  });
}
