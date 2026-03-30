import { resilientFetch } from "@/lib/resilient-fetch";
import type {
  LocationItem,
  VendorItem,
  SalesStatusResponse,
  SalesRefreshResponse,
  CalculateRequest,
  CalculateResponse,
} from "./types";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${response.status})`);
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
    const errorMsg = body?.detail ?? `Error del servidor (${res.status})`;
    throw new Error(errorMsg);
  }

  return handleResponse(res);
}

export async function calculateReplenishment(
  params: CalculateRequest
): Promise<CalculateResponse> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}
