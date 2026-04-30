import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { resilientFetch } from "@/lib/resilient-fetch";
import { db } from "@/lib/firebase";
import { API_BASE } from "./types";
import type { PedidosConfig, PedidoResponse, PedidoLog } from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function getConfig(): Promise<PedidosConfig> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/pedidos/config`),
  );
}

/**
 * POST multipart sin header `Authorization` → request CORS "simple" que no
 * dispara preflight OPTIONS. Esquiva filtros de red corporativos que
 * bloquean OPTIONS o ciertas combinaciones de headers. El backend tiene
 * verify_firebase_token como no-op, así que omitir el token no rompe nada.
 */
function buildPedidoForm(
  fields: Record<string, string>,
  archivo: File,
): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("archivo", archivo);
  return form;
}

export async function enviarPedidoSede(
  proveedor: string,
  sede: string,
  tipo: string,
  mes: string,
  anio: string,
  remitente: string,
  archivo: File,
): Promise<PedidoResponse> {
  const form = buildPedidoForm(
    { proveedor, sede, tipo, mes, anio, remitente },
    archivo,
  );
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/pedidos/sedes`, {
      method: "POST",
      body: form,
      timeout: 120_000,
      skipAuth: true,
    }),
  );
}

export async function enviarPedidoCiudad(
  proveedor: string,
  ciudad: string,
  tipo: string,
  mes: string,
  anio: string,
  remitente: string,
  archivo: File,
): Promise<PedidoResponse> {
  const form = buildPedidoForm(
    { proveedor, ciudad, tipo, mes, anio, remitente },
    archivo,
  );
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/pedidos/ciudad`, {
      method: "POST",
      body: form,
      timeout: 120_000,
      skipAuth: true,
    }),
  );
}

export async function logPedido(
  data: Omit<PedidoLog, "creadoEn">,
): Promise<void> {
  await addDoc(collection(db, "pedidos_log"), {
    ...data,
    creadoEn: serverTimestamp(),
  });
}
