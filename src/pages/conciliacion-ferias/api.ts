import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { resilientFetch } from "@/lib/resilient-fetch";
import { db } from "@/lib/firebase";
import { API_BASE } from "./types";
import type {
  ConciliacionParams,
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

function buildFormData(params: ConciliacionParams): FormData {
  const form = new FormData();
  form.append("file_enviado", params.file_enviado);
  form.append("file_devuelto", params.file_devuelto);
  form.append("location_name", params.location_name);
  form.append("location_id", params.location_id);
  form.append("fecha_inicio", params.fecha_inicio);
  form.append("fecha_fin", params.fecha_fin);
  return form;
}

export async function getLocations(): Promise<{
  locations: LocationOption[];
}> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/conciliacion-ferias/locations`),
  );
}

export async function conciliar(
  params: ConciliacionParams,
): Promise<ConciliacionResponse> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/conciliacion-ferias/conciliar`, {
      method: "POST",
      body: buildFormData(params),
      timeout: 120_000,
    }),
  );
}

export async function exportarExcel(
  params: ConciliacionParams,
): Promise<Blob> {
  const response = await resilientFetch(
    `${API_BASE}/api/conciliacion-ferias/exportar`,
    {
      method: "POST",
      body: buildFormData(params),
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
