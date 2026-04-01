import { resilientFetch } from "@/lib/resilient-fetch";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

export interface SedeRotacion {
  sede: string;
  inventario_unidades: number;
  inventario_skus: number;
  vendidas_unidades: number;
  vendidas_skus: number;
  rotacion: number | null;
  dias_inventario: number | null;
}

export interface TurnoverResult {
  periodo_meses: number;
  fecha_calculo: string;
  sedes: SedeRotacion[];
  totales: {
    inventario_unidades: number;
    vendidas_unidades: number;
    rotacion: number | null;
    dias_inventario: number | null;
  };
}

export interface TurnoverStatus {
  running: boolean;
  phase: string | null;
  error: string | null;
  started_at: string | null;
  result: TurnoverResult | null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function startTurnover(months: number = 12): Promise<{ success: boolean; message: string }> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/turnover/start?months=${months}`, {
      method: "POST",
    })
  );
}

export async function getTurnoverStatus(): Promise<TurnoverStatus> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/turnover/status`, { timeout: 10_000 })
  );
}
