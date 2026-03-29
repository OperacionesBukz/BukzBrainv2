import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE, type GiftCard, type GiftCardCreateRequest, type GiftCardSearchRequest } from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${response.status})`);
  }
  return response.json();
}

export async function healthCheck(): Promise<{ connected: boolean }> {
  const res = await resilientFetch(`${API_BASE}/api/gift-cards/health`);
  return handleResponse(res);
}

export async function createGiftCard(
  data: GiftCardCreateRequest
): Promise<{ success: boolean; gift_card: GiftCard }> {
  const res = await resilientFetch(`${API_BASE}/api/gift-cards/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function searchGiftCards(
  data: GiftCardSearchRequest
): Promise<{ gift_cards: GiftCard[]; total: number; has_next: boolean }> {
  const res = await resilientFetch(`${API_BASE}/api/gift-cards/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function disableGiftCard(
  id: string
): Promise<{ success: boolean; enabled: boolean }> {
  const res = await resilientFetch(`${API_BASE}/api/gift-cards/disable/${encodeURIComponent(id)}`, {
    method: "POST",
  });
  return handleResponse(res);
}
