import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE } from "./types";

export async function enviarCorreoPlaneta(
  file: File,
  destinatarios: string[],
  fechaInicio: string,
  fechaFin: string,
  asunto: string,
): Promise<{ success: boolean; message: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("destinatarios", JSON.stringify(destinatarios));
  form.append("fecha_inicio", fechaInicio);
  form.append("fecha_fin", fechaFin);
  form.append("asunto", asunto);

  const res = await resilientFetch(`${API_BASE}/api/corte-planeta/enviar-correo`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${res.status})`);
  }

  return res.json();
}
