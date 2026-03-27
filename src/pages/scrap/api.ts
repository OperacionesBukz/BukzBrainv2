import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE, type EnrichResponse, type JobStatus, type CacheStats } from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail ?? `Error del servidor (${response.status})`;
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

// Health
export async function healthCheck(): Promise<{ status: string }> {
  return handleResponse(await resilientFetch(`${API_BASE}/api/scrap/health`));
}

// Enrich
export async function enrich(file: File, delay: number = 0.3): Promise<EnrichResponse> {
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ delay: String(delay) });
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/scrap/enrich?${params}`, {
      method: "POST",
      body: form,
    }),
  );
}

// Status polling
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return handleResponse(await resilientFetch(`${API_BASE}/api/scrap/status/${jobId}`));
}

// Download result
export async function downloadResult(jobId: string): Promise<Blob> {
  return handleBlobResponse(await resilientFetch(`${API_BASE}/api/scrap/download/${jobId}`));
}

// Download result in Creacion_productos format
export async function downloadCreacion(jobId: string, vendor?: string): Promise<Blob> {
  const params = new URLSearchParams({ format: "creacion" });
  if (vendor) params.set("vendor", vendor);
  return handleBlobResponse(
    await resilientFetch(`${API_BASE}/api/scrap/download/${jobId}?${params}`),
  );
}

// Vendors list
export async function getVendors(): Promise<string[]> {
  return handleResponse(await resilientFetch(`${API_BASE}/api/scrap/vendors`));
}

// Cache
export async function getCacheStats(): Promise<CacheStats> {
  return handleResponse(await resilientFetch(`${API_BASE}/api/scrap/cache/stats`));
}

export async function clearCache(): Promise<{ success: boolean }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/scrap/cache/clear`, { method: "DELETE" }),
  );
}

// Helpers
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
