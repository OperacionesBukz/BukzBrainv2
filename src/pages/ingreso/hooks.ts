import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  healthCheck,
  searchByIsbn,
  startSearchExcelJob,
  getSearchExcelStatus,
  downloadSearchExcelResult,
  getLocations,
  loadSales,
  getSalesStatus,
  inventoryExcel,
  processCreateProducts,
  createProductsInShopify,
  downloadBlob,
  previewUpdateProducts,
  applyUpdateProducts,
  applyInlineUpdates,
} from "./api";
import type { InlineUpdateItem } from "./types";

export function useHealthCheck() {
  return useQuery({
    queryKey: ["ingreso", "health"],
    queryFn: healthCheck,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useSearchByIsbn(isbn: string) {
  return useQuery({
    queryKey: ["ingreso", "search", isbn],
    queryFn: () => searchByIsbn(isbn),
    enabled: !!isbn,
  });
}

export function useStartSearchJob() {
  return useMutation({
    mutationFn: (file: File) => startSearchExcelJob(file),
  });
}

export function useSearchJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["ingreso", "search-job", jobId],
    queryFn: () => getSearchExcelStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "done" || status === "error") return false;
      return 2000;
    },
  });
}

export function useDownloadSearchResult() {
  return useMutation({
    mutationFn: (jobId: string) => downloadSearchExcelResult(jobId),
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["ingreso", "locations"],
    queryFn: getLocations,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useSalesLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: loadSales,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingreso", "sales", "status"] });
    },
  });
}

export function useSalesStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["ingreso", "sales", "status"],
    queryFn: getSalesStatus,
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Keep polling while job is running or cache not loaded yet
      if (data?.job?.running) return 5000;
      if (data?.cache.loaded) return false;
      return 5000;
    },
  });
}

export function useProcessCreateProducts() {
  return useMutation({
    mutationFn: (file: File) => processCreateProducts(file),
  });
}

export function useCreateProductsInShopify() {
  return useMutation({
    mutationFn: (file: File) => createProductsInShopify(file),
  });
}

export function useInventoryExcel() {
  return useMutation({
    mutationFn: ({
      file,
      locationNames,
      includeSales,
    }: {
      file: File;
      locationNames: string[];
      includeSales: boolean;
    }) => inventoryExcel(file, locationNames, includeSales),
  });
}

export function usePreviewUpdate() {
  return useMutation({
    mutationFn: (file: File) => previewUpdateProducts(file),
  });
}

export function useApplyUpdate() {
  return useMutation({
    mutationFn: (file: File) => applyUpdateProducts(file),
  });
}

export function useApplyInlineUpdate() {
  return useMutation({
    mutationFn: (items: InlineUpdateItem[]) => applyInlineUpdates(items),
  });
}
