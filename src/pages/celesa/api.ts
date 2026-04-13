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
  elapsed_seconds?: number;
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
  started_at: number | null;
  matrixify_job_id: number | null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function uploadCelesaCsv(file: File): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch(`${API_BASE}/api/celesa/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(resp);
}

export async function getCelesaStatus(): Promise<CelesaStatus> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa/status`, { timeout: 10_000 })
  );
}

export async function cancelCelesaJob(): Promise<{ success: boolean; message: string }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa/cancel`, { method: "POST" })
  );
}

export async function importViaMatrixify(): Promise<{ success: boolean; message: string }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa/matrixify`, { method: "POST" })
  );
}

export function getMatrixifyDownloadUrl(): string {
  return `${API_BASE}/api/celesa/matrixify-download`;
}

// -- Celesa Sync (Shopify → Seguimiento) ------------------------------------

export interface SyncOrder {
  numeroPedido: string;
  cliente: string;
  producto: string;
  isbn: string;
  fechaPedido: string;
}

export interface SyncSummary {
  found: number;
  existing_in_firestore: number;
}

export interface CelesaSyncStatus {
  running: boolean;
  phase: string | null;
  error: string | null;
  orders: SyncOrder[] | null;
  summary: SyncSummary | null;
}

export async function fetchCelesaSyncOrders(): Promise<{ success: boolean; message: string }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa-sync/fetch`, {
      method: "POST",
      timeout: 30_000,
    })
  );
}

export async function getCelesaSyncStatus(): Promise<CelesaSyncStatus> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa-sync/status`, { timeout: 10_000 })
  );
}

export async function importCelesaSyncOrders(
  orders: SyncOrder[],
  createdBy: string
): Promise<{ success: boolean; message: string; imported: number }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/celesa-sync/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders, createdBy }),
      timeout: 30_000,
    })
  );
}
