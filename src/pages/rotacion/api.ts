import { resilientFetch } from "@/lib/resilient-fetch";
import type { TurnoverStatus, InventoryPreview } from "./types";

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

export interface StartWithExcelResponse {
  success: boolean;
  message?: string;
  error?: string;
  inventory_preview?: InventoryPreview[];
}

export async function startTurnoverWithExcel(
  file: File,
  months: number,
): Promise<StartWithExcelResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("months", String(months));
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/turnover/start-with-excel`, {
      method: "POST",
      body: formData,
    }),
  );
}

export async function getTurnoverStatus(): Promise<TurnoverStatus> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/turnover/status`, { timeout: 10_000 }),
  );
}
