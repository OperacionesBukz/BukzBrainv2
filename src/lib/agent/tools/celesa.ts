// src/lib/agent/tools/celesa.ts
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const celesaTools: ToolDefinition[] = [
  {
    name: "queryCelesaOrders",
    description: "Consulta pedidos de Celesa con filtro opcional por estado y límite de resultados.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filtrar por estado del pedido (opcional)",
        },
        limit: {
          type: "number",
          description: "Número máximo de resultados a devolver (por defecto 20)",
        },
      },
      required: [],
    },
    execute: async (params) => {
      try {
        const ref = collection(db, "celesa_orders");
        const constraints = [];
        if (params.status) {
          constraints.push(where("status", "==", params.status));
        }
        const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);
        const snapshot = await getDocs(q);
        const limit = typeof params.limit === "number" ? params.limit : 20;
        const data = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .slice(0, limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
  {
    name: "getCelesaStats",
    description: "Obtiene estadísticas de pedidos de Celesa: total y conteo agrupado por estado.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      try {
        const ref = collection(db, "celesa_orders");
        const snapshot = await getDocs(ref);
        const byStatus: Record<string, number> = {};
        snapshot.docs.forEach((d) => {
          const status = (d.data().status as string) ?? "unknown";
          byStatus[status] = (byStatus[status] ?? 0) + 1;
        });
        return {
          success: true,
          data: { total: snapshot.size, byStatus },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
