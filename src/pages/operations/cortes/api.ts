import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE } from "./types";

async function handleBlobResponse(response: Response): Promise<Blob> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${response.status})`);
  }
  return response.blob();
}

export async function processCortes(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  return handleBlobResponse(
    await resilientFetch(`${API_BASE}/api/cortes/process`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function processDescuento(file: File, porcentaje: number): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("porcentaje", String(porcentaje));
  return handleBlobResponse(
    await resilientFetch(`${API_BASE}/api/cortes/descuento`, {
      method: "POST",
      body: form,
    }),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
