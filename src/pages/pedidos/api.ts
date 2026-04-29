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

export async function enviarPedidoSede(
  proveedor: string,
  sede: string,
  tipo: string,
  mes: string,
  anio: string,
  remitente: string,
  archivo: File,
): Promise<PedidoResponse> {
  const form = new FormData();
  form.append("proveedor", proveedor);
  form.append("sede", sede);
  form.append("tipo", tipo);
  form.append("mes", mes);
  form.append("anio", anio);
  form.append("remitente", remitente);
  form.append("archivo", archivo);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/pedidos/sedes`, {
      method: "POST",
      body: form,
      timeout: 120_000,
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
  const form = new FormData();
  form.append("proveedor", proveedor);
  form.append("ciudad", ciudad);
  form.append("tipo", tipo);
  form.append("mes", mes);
  form.append("anio", anio);
  form.append("remitente", remitente);
  form.append("archivo", archivo);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/pedidos/ciudad`, {
      method: "POST",
      body: form,
      timeout: 120_000,
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
