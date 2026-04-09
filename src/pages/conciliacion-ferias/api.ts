import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { resilientFetch } from "@/lib/resilient-fetch";
import { db } from "@/lib/firebase";
import { API_BASE } from "./types";
import type {
  ConciliacionRequest,
  ConciliacionResponse,
  ConciliacionLog,
  LocationOption,
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

export async function getLocations(): Promise<{
  locations: LocationOption[];
}> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/conciliacion-ferias/locations`),
  );
}

export async function conciliar(
  req: ConciliacionRequest,
): Promise<ConciliacionResponse> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/conciliacion-ferias/conciliar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      timeout: 120_000, // 2 min - puede tardar con mucho volumen
    }),
  );
}

export async function exportarExcel(
  req: ConciliacionRequest,
): Promise<Blob> {
  const response = await resilientFetch(
    `${API_BASE}/api/conciliacion-ferias/exportar`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      timeout: 120_000,
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.detail ?? `Error del servidor (${response.status})`,
    );
  }
  return response.blob();
}

export async function logConciliacion(
  data: Omit<ConciliacionLog, "creadoEn">,
): Promise<void> {
  await addDoc(collection(db, "conciliacion_ferias_log"), {
    ...data,
    creadoEn: serverTimestamp(),
  });
}
