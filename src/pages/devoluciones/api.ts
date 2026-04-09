import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { resilientFetch } from "@/lib/resilient-fetch";
import { db } from "@/lib/firebase";
import { API_BASE } from "./types";
import type { DevolucionesConfig, DevolucionItem, EnvioResponse } from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function getConfig(): Promise<DevolucionesConfig> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/devoluciones/config`),
  );
}

export async function enviarSedes(
  sede: string,
  motivo: string,
  proveedorNombre: string,
  archivo: File,
  remitente: string,
): Promise<EnvioResponse> {
  const form = new FormData();
  form.append("sede", sede);
  form.append("motivo", motivo);
  form.append("proveedor_nombre", proveedorNombre);
  form.append("archivo", archivo);
  form.append("remitente", remitente);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/devoluciones/sedes`, {
      method: "POST",
      body: form,
      timeout: 60_000,
    }),
  );
}

export async function enviarProveedores(
  proveedor: string,
  motivo: string,
  ciudad: string,
  numCajas: number,
  archivo: File,
  remitente: string,
): Promise<EnvioResponse> {
  const form = new FormData();
  form.append("proveedor", proveedor);
  form.append("motivo", motivo);
  form.append("ciudad", ciudad);
  form.append("num_cajas", String(numCajas));
  form.append("archivo", archivo);
  form.append("remitente", remitente);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/devoluciones/proveedores`, {
      method: "POST",
      body: form,
      timeout: 60_000,
    }),
  );
}

export async function logDevolucion(
  data: Omit<import("./types").DevolucionLog, "creadoEn">,
): Promise<void> {
  await addDoc(collection(db, "devoluciones_log"), {
    ...data,
    creadoEn: serverTimestamp(),
  });
}

export async function crearTareaDevolucion(params: {
  motivo: string;
  destinatario: string;
  codigoDevolucion: string;
  createdBy: string;
  items?: DevolucionItem[];
}): Promise<void> {
  const today = new Date();
  const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await addDoc(collection(db, "tasks"), {
    title: `${params.motivo}-${params.destinatario}-${params.codigoDevolucion}`,
    department: "Devolución",
    status: "todo",
    notes: "",
    subtasks: [],
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
    order: Date.now(),
    startDate,
    ...(params.items?.length ? { devolucionItems: params.items.map(i => ({ ...i, recibido: false })) } : {}),
  });
}
