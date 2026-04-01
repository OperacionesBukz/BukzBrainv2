import { resilientFetch } from "@/lib/resilient-fetch";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

export interface CelesaDifference {
  sku: string;
  title: string;
  vendor: string;
  shopify_qty: number;
  azeta_qty: number;
  diff: number;
  inventory_item_id: string;
}

export interface CelesaSummary {
  total_azeta_skus: number;
  total_shopify_items: number;
  differences_found: number;
}

export interface ApplyResult {
  applied: number;
  total: number;
  errors: string[];
}

export interface CelesaStatus {
  running: boolean;
  phase: string | null;
  error: string | null;
  summary: CelesaSummary | null;
  differences: CelesaDifference[] | null;
  applying: boolean;
  apply_phase: string | null;
  apply_error: string | null;
  apply_result: ApplyResult | null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function startCelesaComparison(): Promise<{ success: boolean; message: string }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa/start`, { method: "POST" })
  );
}

export async function getCelesaStatus(): Promise<CelesaStatus> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa/status`, { timeout: 10_000 })
  );
}

export async function applyCelesaChanges(): Promise<{ success: boolean; message: string }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa/apply`, { method: "POST" })
  );
}
