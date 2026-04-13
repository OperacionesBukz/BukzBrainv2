import { resilientFetch } from "@/lib/resilient-fetch";
import type {
  DeadStockConfig,
  DeadStockStatus,
  StartResponse,
} from "./types";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function startDeadStockAnalysis(
  config: DeadStockConfig,
): Promise<StartResponse> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/dead-stock/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }),
  );
}

export async function getDeadStockStatus(): Promise<DeadStockStatus> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/dead-stock/status`, {
      timeout: 10_000,
    }),
  );
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
