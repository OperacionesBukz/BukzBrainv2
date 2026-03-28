import { resilientFetch } from "@/lib/resilient-fetch";
import {
  API_BASE,
  type ProductSearchResult,
  type LocationItem,
  type SalesLoadResponse,
  type SalesStatusResponse,
  type ShopifyCreateResponse,
  type UpdatePreviewResponse,
  type UpdateApplyResponse,
  type InlineUpdateItem,
} from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

async function handleBlobResponse(response: Response): Promise<Blob> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${response.status})`);
  }
  return response.blob();
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function healthCheck(): Promise<{ connected: boolean }> {
  return handleResponse(await resilientFetch(`${API_BASE}/api/ingreso/health`));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchByIsbn(
  isbn: string,
): Promise<{ product: ProductSearchResult }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/search/${encodeURIComponent(isbn)}`),
  );
}

export async function searchByExcel(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  return handleBlobResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/search/excel`, {
      method: "POST",
      body: form,
    }),
  );
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function getLocations(): Promise<{
  locations: LocationItem[];
}> {
  return handleResponse(await resilientFetch(`${API_BASE}/api/ingreso/locations`));
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export async function loadSales(): Promise<SalesLoadResponse> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/sales/load`, { method: "POST" }),
  );
}

export async function getSalesStatus(): Promise<SalesStatusResponse> {
  return handleResponse(await resilientFetch(`${API_BASE}/api/ingreso/sales/status`));
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function inventoryExcel(
  file: File,
  locationNames: string[],
  includeSales: boolean,
): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({
    locations: locationNames.join(","),
    include_sales: String(includeSales),
  });
  return handleBlobResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/inventory/excel?${params}`, {
      method: "POST",
      body: form,
    }),
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function downloadTemplate(
  type: "creacion" | "actualizacion",
): Promise<Blob> {
  return handleBlobResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/templates/${type}`),
  );
}

// ---------------------------------------------------------------------------
// Crear Productos
// ---------------------------------------------------------------------------

export async function processCreateProducts(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  return handleBlobResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/productos/crear`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function createProductsInShopify(
  file: File,
): Promise<ShopifyCreateResponse> {
  const form = new FormData();
  form.append("file", file);
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/productos/shopify`, {
      method: "POST",
      body: form,
    }),
  );
}

// ---------------------------------------------------------------------------
// Actualizar Productos
// ---------------------------------------------------------------------------

export async function previewUpdateProducts(file: File): Promise<UpdatePreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/productos/actualizar/preview`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function applyUpdateProducts(file: File): Promise<UpdateApplyResponse> {
  const form = new FormData();
  form.append("file", file);
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/productos/actualizar/apply`, {
      method: "POST",
      body: form,
    }),
  );
}

// ---------------------------------------------------------------------------
// Inline Update (from search table)
// ---------------------------------------------------------------------------

export async function applyInlineUpdates(
  items: InlineUpdateItem[],
): Promise<UpdateApplyResponse> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/productos/actualizar/inline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
