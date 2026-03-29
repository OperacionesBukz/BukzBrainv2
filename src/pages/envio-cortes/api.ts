import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE } from "./types";
import type { VentasResponse, NoVentasResponse } from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function enviarCortesVentas(
  proveedoresFile: File,
  ventasFile: File,
  mes: string,
  anio: string,
  remitente: string,
): Promise<VentasResponse> {
  const form = new FormData();
  form.append("proveedores_file", proveedoresFile);
  form.append("ventas_file", ventasFile);
  form.append("mes", mes);
  form.append("anio", anio);
  form.append("remitente", remitente);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/envio-cortes/ventas`, {
      method: "POST",
      body: form,
      timeout: 120_000,
    }),
  );
}

export async function enviarCortesNoVentas(
  proveedoresFile: File,
  estadoFile: File,
  mes: string,
  anio: string,
  remitente: string,
): Promise<NoVentasResponse> {
  const form = new FormData();
  form.append("proveedores_file", proveedoresFile);
  form.append("estado_file", estadoFile);
  form.append("mes", mes);
  form.append("anio", anio);
  form.append("remitente", remitente);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/envio-cortes/no-ventas`, {
      method: "POST",
      body: form,
      timeout: 120_000,
    }),
  );
}

export interface IndividualResponse {
  success: boolean;
  proveedor: string;
  correo: string;
  correo_cc: string[];
  asunto: string;
  filas_procesadas: number;
}

export async function enviarCorteIndividual(
  ventasFile: File,
  proveedor: string,
  correo: string,
  correoCc: string,
  mes: string,
  anio: string,
  remitente: string,
): Promise<IndividualResponse> {
  const form = new FormData();
  form.append("ventas_file", ventasFile);
  form.append("proveedor", proveedor);
  form.append("correo", correo);
  form.append("correo_cc", correoCc);
  form.append("mes", mes);
  form.append("anio", anio);
  form.append("remitente", remitente);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/envio-cortes/individual`, {
      method: "POST",
      body: form,
      timeout: 60_000,
    }),
  );
}

export function downloadZipFromBase64(base64: string, filename: string) {
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
