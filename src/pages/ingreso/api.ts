import {
  API_BASE,
  type ProductSearchResult,
  type LocationItem,
  type SalesLoadResponse,
  type SalesStatusResponse,
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
  return handleResponse(await fetch(`${API_BASE}/api/ingreso/health`));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchByIsbn(
  isbn: string,
): Promise<{ product: ProductSearchResult }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/ingreso/search/${encodeURIComponent(isbn)}`),
  );
}

export async function searchByExcel(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  return handleBlobResponse(
    await fetch(`${API_BASE}/api/ingreso/search/excel`, {
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
  return handleResponse(await fetch(`${API_BASE}/api/ingreso/locations`));
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export async function loadSales(): Promise<SalesLoadResponse> {
  return handleResponse(
    await fetch(`${API_BASE}/api/ingreso/sales/load`, { method: "POST" }),
  );
}

export async function getSalesStatus(): Promise<SalesStatusResponse> {
  return handleResponse(await fetch(`${API_BASE}/api/ingreso/sales/status`));
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
    await fetch(`${API_BASE}/api/ingreso/inventory/excel?${params}`, {
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
    await fetch(`${API_BASE}/api/ingreso/templates/${type}`),
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
