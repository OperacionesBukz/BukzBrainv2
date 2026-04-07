// src/lib/agent/tools/email-draft.ts
// Tools de correo para el agente IA.
// draftEmail: genera y muestra borrador
// sendEmail: envía el correo vía SMTP del backend

import { resilientFetch } from "@/lib/resilient-fetch";
import type { ToolDefinition } from "../types";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

export const emailDraftTools: ToolDefinition[] = [
  {
    name: "draftEmail",
    description: `Genera un borrador de correo electrónico profesional y lo muestra al usuario.

Casos de uso:
- Solicitar reposición urgente a un proveedor
- Follow-up de devoluciones pendientes
- Reclamar pedidos atrasados
- Informar sobre cortes/conciliaciones
- Coordinar envíos entre sedes

El resultado se muestra al usuario como borrador para revisar antes de enviar.

Instrucciones para el agente:
- Redactar en español formal pero cercano
- Incluir datos específicos (SKUs, cantidades, fechas) cuando estén disponibles
- Ser directo y profesional
- Adaptar el tono según la urgencia
- Después de mostrar el borrador, preguntar si desea enviarlo o ajustarlo`,
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Destinatario (nombre del proveedor, sede o persona)",
        },
        subject: {
          type: "string",
          description: "Asunto del correo",
        },
        body: {
          type: "string",
          description: "Cuerpo del correo completo (el agente lo redacta)",
        },
        urgency: {
          type: "string",
          enum: ["normal", "urgente", "critico"],
          description: "Nivel de urgencia del correo",
        },
      },
      required: ["to", "subject", "body"],
    },
    execute: async (params) => {
      try {
        const to = params.to as string;
        const subject = params.subject as string;
        const body = params.body as string;
        const urgency = (params.urgency as string) ?? "normal";

        const urgencyLabel =
          urgency === "critico" ? "CRITICO" :
          urgency === "urgente" ? "URGENTE" : "";

        const formattedDraft = [
          `**Para:** ${to}`,
          `**Asunto:** ${urgencyLabel ? urgencyLabel + " — " : ""}${subject}`,
          "",
          "---",
          "",
          body,
          "",
          "---",
          "",
          "*Borrador listo. Puedes pedir que lo envie, lo ajuste, o copiarlo manualmente.*",
        ].join("\n");

        return {
          success: true,
          data: {
            draft: formattedDraft,
            to,
            subject: urgencyLabel ? `${urgencyLabel} — ${subject}` : subject,
            body,
            urgency,
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "sendEmail",
    description: `Envía un correo electrónico vía SMTP. Usa esto SOLO después de haber mostrado un borrador con draftEmail y que el usuario haya confirmado el envío. Siempre se envía copia a operaciones@bukz.co.`,
    parameters: {
      type: "object",
      properties: {
        to_email: {
          type: "string",
          description: "Dirección de correo del destinatario",
        },
        subject: {
          type: "string",
          description: "Asunto del correo",
        },
        email_body: {
          type: "string",
          description: "Cuerpo del correo en texto (puede incluir HTML básico)",
        },
      },
      required: ["to_email", "subject", "email_body"],
    },
    execute: async (params) => {
      try {
        const res = await resilientFetch(`${API_BASE}/api/email/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: params.to_email as string,
            subject: params.subject as string,
            email_body: params.email_body as string,
          }),
          timeout: 30_000,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail ?? `Error ${res.status}`);
        }

        return {
          success: true,
          data: {
            message: "Correo enviado exitosamente",
            to: params.to_email,
            subject: params.subject,
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
