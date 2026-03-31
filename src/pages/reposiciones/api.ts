import { resilientFetch } from "@/lib/resilient-fetch";
import type {
  LocationItem,
  VendorItem,
  SalesStatusResponse,
  SalesRefreshResponse,
  CalculateRequest,
  CalculateResponse,
  ApproveRequest,
  ApproveResponse,
  GenerateOrdersRequest,
  GenerateOrdersResponse,
  ExportOrdersRequest,
  ExportOrdersResponse,
  MarkSentResponse,
  OrderListItem,
  ReplenishmentOrder,
  StatusTransitionRequest,
  StatusTransitionResponse,
  SingleExportResponse,
} from "./types";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    let msg: string;
    if (typeof detail === "string") {
      msg = detail;
    } else if (Array.isArray(detail)) {
      // FastAPI 422 validation errors: [{loc: [...], msg: "...", type: "..."}]
      msg = detail.map((e: { msg?: string; loc?: string[] }) =>
        `${e.loc?.slice(1).join(".") ?? "campo"}: ${e.msg ?? "invalido"}`
      ).join("; ");
    } else {
      msg = detail?.message ?? detail?.error ?? `Error del servidor (${response.status})`;
    }
    throw new Error(msg);
  }
  return response.json();
}

export async function getLocations(): Promise<LocationItem[]> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/locations`);
  return handleResponse(res);
}

export async function getVendors(): Promise<VendorItem[]> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/vendors`);
  return handleResponse(res);
}

export async function getSalesStatus(): Promise<SalesStatusResponse> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/sales/status`);
  return handleResponse(res);
}

export async function refreshSales(
  dateRangeDays: number
): Promise<SalesRefreshResponse> {
  const res = await resilientFetch(
    `${API_BASE}/api/reposiciones/sales/refresh?date_range_days=${dateRangeDays}`,
    { method: "POST" }
  );

  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    if (body?.error === "OPERATION_IN_PROGRESS") {
      throw new Error(
        body.message || "Hay una operacion Bulk en curso en Shopify"
      );
    }
    const det = body?.detail;
    const errorMsg =
      typeof det === "string"
        ? det
        : det?.message ?? det?.error ?? `Error del servidor (${res.status})`;
    throw new Error(errorMsg);
  }

  return handleResponse(res);
}

export async function startCalculation(
  params: CalculateRequest
): Promise<{ job_id: string; status: string }> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

export async function getCalculationStatus(
  jobId: string
): Promise<CalculateResponse | { status: string; step: string; progress: number }> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/calculate/${jobId}`);
  return handleResponse(res);
}

// ─── Phase 7: Approval, Orders, Export ────────────────────────────────────

export async function approveDraft(params: ApproveRequest): Promise<ApproveResponse> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<ApproveResponse>(res);
}

export async function generateOrders(
  params: GenerateOrdersRequest
): Promise<GenerateOrdersResponse> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/orders/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<GenerateOrdersResponse>(res);
}

export async function exportOrdersZip(
  params: ExportOrdersRequest
): Promise<ExportOrdersResponse> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/orders/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<ExportOrdersResponse>(res);
}

export async function markOrderSent(
  orderId: string,
  sentBy: string
): Promise<MarkSentResponse> {
  const res = await resilientFetch(
    `${API_BASE}/api/reposiciones/orders/${orderId}/send?sent_by=${encodeURIComponent(sentBy)}`,
    { method: "PATCH" }
  );
  return handleResponse<MarkSentResponse>(res);
}

export function downloadZipFromBase64(base64: string, filename: string): void {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Phase 8: Order History ──────────────────────────────────────────────

export async function getOrderList(params?: {
  vendor?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}): Promise<{ orders: OrderListItem[] }> {
  const searchParams = new URLSearchParams();
  if (params?.vendor) searchParams.set("vendor", params.vendor);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  const qs = searchParams.toString();
  const url = `${API_BASE}/api/reposiciones/orders${qs ? `?${qs}` : ""}`;
  const res = await resilientFetch(url);
  return handleResponse(res);
}

export async function getOrderDetail(orderId: string): Promise<ReplenishmentOrder> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/orders/${orderId}`);
  return handleResponse(res);
}

export async function transitionOrderStatus(
  orderId: string,
  body: StatusTransitionRequest
): Promise<StatusTransitionResponse> {
  const res = await resilientFetch(
    `${API_BASE}/api/reposiciones/orders/${orderId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return handleResponse(res);
}

export async function deleteOrder(orderId: string): Promise<{ id: string; message: string }> {
  const res = await resilientFetch(
    `${API_BASE}/api/reposiciones/orders/${orderId}`,
    { method: "DELETE" }
  );
  return handleResponse(res);
}

export async function exportSingleOrder(
  orderId: string
): Promise<SingleExportResponse> {
  const res = await resilientFetch(
    `${API_BASE}/api/reposiciones/orders/${orderId}/export`
  );
  return handleResponse(res);
}

export function downloadExcelFromBase64(base64: string, filename: string): void {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
