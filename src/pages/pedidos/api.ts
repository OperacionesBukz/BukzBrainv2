import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { resilientFetch } from "@/lib/resilient-fetch";
import { db } from "@/lib/firebase";
import { API_BASE } from "./types";
import type { PedidosConfig, PedidoResponse, PedidoLog } from "./types";

const OUTBOX_COLLECTION = "pedidos_outbox";
const OUTBOX_TIMEOUT_MS = 180_000; // 3 min — backend polea cada 8s + SMTP

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
 * Codifica un File a base64 (chunked para no romper la pila de llamadas
 * en archivos grandes).
 */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
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

/**
 * Envía un pedido vía cola Firestore. Esquiva cualquier bloqueo de red
 * sobre easypanel.host porque el frontend solo escribe a Firebase.
 *
 * Flujo:
 * 1. Crea doc pendiente en `pedidos_outbox` con archivo en base64.
 * 2. Backend (scheduler cada 8s) lo procesa, envía email, actualiza status.
 * 3. Frontend escucha el doc en tiempo real hasta que llegue a sent/error.
 */
async function enviarPedidoViaOutbox(
  kind: "sede" | "ciudad",
  destino: string,
  proveedor: string,
  tipo: string,
  mes: string,
  anio: string,
  remitente: string,
  archivo: File,
  enviadoPor: string,
): Promise<PedidoResponse> {
  const archivo_b64 = await fileToBase64(archivo);
  const docRef = await addDoc(collection(db, OUTBOX_COLLECTION), {
    kind,
    destino,
    proveedor,
    tipo,
    mes,
    anio,
    remitente,
    archivo_b64,
    archivo_nombre: archivo.name,
    status: "pending",
    enviado_por: enviadoPor,
    created_at: serverTimestamp(),
  });

  return new Promise<PedidoResponse>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          "Tiempo agotado esperando al servidor (3 min). Intentá de nuevo en un momento.",
        ),
      );
    }, OUTBOX_TIMEOUT_MS);

    const unsubscribe = onSnapshot(
      doc(db, OUTBOX_COLLECTION, docRef.id),
      (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.status === "sent") {
          window.clearTimeout(timeoutId);
          unsubscribe();
          resolve({
            success: true,
            proveedor: data.proveedor,
            sede: kind === "sede" ? data.destino : undefined,
            ciudad: kind === "ciudad" ? data.destino : undefined,
            correos: data.correos ?? [],
            asunto: data.asunto ?? "",
          });
        } else if (data.status === "error" || data.status === "expired") {
          window.clearTimeout(timeoutId);
          unsubscribe();
          reject(new Error(data.error ?? "Error desconocido"));
        }
      },
      (err) => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        reject(err);
      },
    );
  });
}

export async function enviarPedidoSede(
  proveedor: string,
  sede: string,
  tipo: string,
  mes: string,
  anio: string,
  remitente: string,
  archivo: File,
  enviadoPor = "",
): Promise<PedidoResponse> {
  return enviarPedidoViaOutbox(
    "sede",
    sede,
    proveedor,
    tipo,
    mes,
    anio,
    remitente,
    archivo,
    enviadoPor,
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
  enviadoPor = "",
): Promise<PedidoResponse> {
  return enviarPedidoViaOutbox(
    "ciudad",
    ciudad,
    proveedor,
    tipo,
    mes,
    anio,
    remitente,
    archivo,
    enviadoPor,
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
