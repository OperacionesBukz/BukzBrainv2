// src/lib/agent/tools/inventory.ts
// Tools de inventario y ventas para el agente IA.
// Llaman a los endpoints /api/commands/* del backend (Firestore caches).

import { resilientFetch } from "@/lib/resilient-fetch";
import type { ToolDefinition } from "../types";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

async function apiGet<T>(path: string): Promise<T> {
  const res = await resilientFetch(`${API_BASE}${path}`, { timeout: 30_000 });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Error ${res.status}`);
  }
  return res.json();
}

export const inventoryTools: ToolDefinition[] = [
  {
    name: "getProductStock",
    description:
      "Consulta stock de un producto por ISBN/SKU. Devuelve: título, vendor, stock total, stock por sede, ventas totales y ventas por mes. Usa esto para analizar un producto específico.",
    parameters: {
      type: "object",
      properties: {
        isbn: {
          type: "string",
          description: "ISBN o SKU del producto",
        },
      },
      required: ["isbn"],
    },
    execute: async (params) => {
      try {
        const data = await apiGet(`/api/commands/stock/${encodeURIComponent(params.isbn as string)}`);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "getProductSales",
    description:
      "Historial de ventas mensual de un producto por ISBN/SKU. Devuelve: título, vendor, total vendido y desglose por mes. Usa esto para analizar tendencia de ventas.",
    parameters: {
      type: "object",
      properties: {
        isbn: {
          type: "string",
          description: "ISBN o SKU del producto",
        },
      },
      required: ["isbn"],
    },
    execute: async (params) => {
      try {
        const data = await apiGet(`/api/commands/ventas/${encodeURIComponent(params.isbn as string)}`);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "getTopSellers",
    description:
      "Top productos más vendidos, opcionalmente filtrado por sede y/o mes. Devuelve lista con SKU, título, vendor y unidades vendidas. Usa esto para comparar rendimiento o identificar bestsellers.",
    parameters: {
      type: "object",
      properties: {
        sede: {
          type: "string",
          description: "Nombre de la sede/ubicación (opcional). Ej: 'Unicentro', 'Museo'",
        },
        mes: {
          type: "string",
          description: "Mes para filtrar (opcional). Puede ser nombre ('marzo'), número ('3') o formato 'YYYY-MM'",
        },
        limit: {
          type: "integer",
          description: "Máximo de resultados (por defecto 20)",
        },
      },
      required: [],
    },
    execute: async (params) => {
      try {
        const searchParams = new URLSearchParams();
        if (params.sede) searchParams.set("sede", params.sede as string);
        if (params.mes) searchParams.set("mes", params.mes as string);
        searchParams.set("limit", String(params.limit ?? 20));
        const data = await apiGet(`/api/commands/top?${searchParams.toString()}`);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "getOutOfStock",
    description:
      "Lista productos agotados (stock 0) en una sede específica. Devuelve: sede, total agotados, porcentaje y lista con SKU/título/vendor. Usa esto para diagnosticar problemas de stock.",
    parameters: {
      type: "object",
      properties: {
        sede: {
          type: "string",
          description: "Nombre de la sede. Ej: 'Unicentro', 'Museo', 'Centro'",
        },
      },
      required: ["sede"],
    },
    execute: async (params) => {
      try {
        const data = await apiGet(`/api/commands/agotados?sede=${encodeURIComponent(params.sede as string)}`);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "getOperationalSummary",
    description:
      "Resumen operativo completo: inventario por sede (productos, agotados, stock), estado de ventas, tareas pendientes. Usa esto para dar panorama general o diagnosticar problemas globales.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      try {
        const data = await apiGet("/api/commands/resumen");
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
