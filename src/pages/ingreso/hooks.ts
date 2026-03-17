import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  healthCheck,
  searchByIsbn,
  searchByExcel,
  getLocations,
  loadSales,
  getSalesStatus,
  inventoryExcel,
  downloadBlob,
} from "./api";

export function useHealthCheck() {
  return useQuery({
    queryKey: ["ingreso", "health"],
    queryFn: healthCheck,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSearchByIsbn(isbn: string) {
  return useQuery({
    queryKey: ["ingreso", "search", isbn],
    queryFn: () => searchByIsbn(isbn),
    enabled: !!isbn,
  });
}

export function useSearchByExcel() {
  return useMutation({
    mutationFn: (file: File) => searchByExcel(file),
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
      if (data?.cache.loaded) return false;
      return 5000;
    },
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
