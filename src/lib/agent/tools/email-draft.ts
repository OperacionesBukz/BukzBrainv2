// src/lib/agent/tools/email-draft.ts
// Tool de redacción de correos para el agente IA.
// El LLM genera el contenido; este tool lo presenta formateado al usuario.

import type { ToolDefinition } from "../types";

export const emailDraftTools: ToolDefinition[] = [
  {
    name: "draftEmail",
    description: `Genera un borrador de correo electrónico profesional. El agente DEBE redactar el contenido del email basado en el contexto de la conversación y los datos disponibles.

Casos de uso:
- Solicitar reposición urgente a un proveedor
- Follow-up de devoluciones pendientes
- Reclamar pedidos atrasados
- Informar sobre cortes/conciliaciones
- Coordinar envíos entre sedes

El resultado se muestra al usuario como borrador para revisar. NO se envía automáticamente.

Instrucciones para el agente:
- Redactar en español formal pero cercano
- Incluir datos específicos (SKUs, cantidades, fechas)
- Ser directo y profesional
- Adaptar el tono según la urgencia`,
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
          description: "Cuerpo del correo (el agente lo redacta completo)",
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
          urgency === "critico" ? "🔴 CRÍTICO" :
          urgency === "urgente" ? "🟠 URGENTE" : "";

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
          "*Este es un borrador. Puedes copiarlo y enviarlo desde tu correo, o pedir que lo ajuste.*",
        ].join("\n");

        return {
          success: true,
          data: {
            draft: formattedDraft,
            to,
            subject,
            urgency,
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
