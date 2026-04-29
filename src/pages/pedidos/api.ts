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

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // btoa con strings binarios; troceamos para no reventar el call stack en archivos grandes.
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(binary);
}

async function enviarPedidoJSON(
  endpoint: "sedes-json" | "ciudad-json",
  destino: string,
  proveedor: string,
  tipo: string,
  mes: string,
  anio: string,
  remitente: string,
  archivo: File,
): Promise<PedidoResponse> {
  const archivo_b64 = await fileToBase64(archivo);
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/pedidos/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedor,
        destino,
        tipo,
        mes,
        anio,
        remitente,
        archivo_b64,
        archivo_nombre: archivo.name,
      }),
      timeout: 120_000,
    }),
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
  return enviarPedidoJSON(
    "sedes-json",
    sede,
    proveedor,
    tipo,
    mes,
    anio,
    remitente,
    archivo,
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
  return enviarPedidoJSON(
    "ciudad-json",
    ciudad,
    proveedor,
    tipo,
    mes,
    anio,
    remitente,
    archivo,
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
