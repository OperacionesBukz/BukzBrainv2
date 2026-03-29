import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { healthCheck, createGiftCard, searchGiftCards, disableGiftCard } from "./api";
import type { GiftCardCreateRequest, GiftCardSearchRequest } from "./types";

export function useHealthCheck() {
  return useQuery({
    queryKey: ["gift-cards", "health"],
    queryFn: healthCheck,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useSearchGiftCards(params: GiftCardSearchRequest) {
  return useQuery({
    queryKey: ["gift-cards", "search", params.query, params.limit],
    queryFn: () => searchGiftCards(params),
    staleTime: 30 * 1000,
  });
}

export function useCreateGiftCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GiftCardCreateRequest) => createGiftCard(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gift-cards", "search"] });
    },
  });
}

export function useDisableGiftCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disableGiftCard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gift-cards", "search"] });
    },
  });
}
