import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  where,
  limit as firestoreLimit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";
import { cached } from "./cache";

export const celesaTools: ToolDefinition[] = [
  {
    name: "queryCelesaOrders",
    description: "Consulta pedidos de Celesa. Puede buscar por número de pedido, por estado, o listar todos. Campos de cada pedido: numeroPedido, cliente, producto, isbn, fechaPedido, estado (En curso/Entregado/Agotado/Atrasado).",
    parameters: {
      type: "object",
      properties: {
        numeroPedido: {
          type: "string",
          description: "Número de pedido exacto para buscar (ej: '192197')",
        },
        estado: {
          type: "string",
          description: "Filtrar por estado: Pendiente, Entregado, Agotado, Atrasado",
        },
        limit: {
          type: "string",
          description: "Máximo de resultados (por defecto 20)",
        },
      },
    },
    execute: async (params) => {
      try {
        const ref = collection(db, "celesa_orders");
        const constraints = [];
        if (params.numeroPedido) {
          // numeroPedido in Firestore is stored with # prefix (e.g. "#192197")
          let num = String(params.numeroPedido).trim();
          if (!num.startsWith("#")) num = "#" + num;
          constraints.push(where("numeroPedido", "==", num));
        }
        if (params.estado) {
          constraints.push(where("estado", "==", params.estado));
        }
        const maxResults = params.limit ? Number(params.limit) : 20;
        const q = constraints.length > 0
          ? query(ref, ...constraints, firestoreLimit(maxResults))
          : query(ref, firestoreLimit(maxResults));
        const snapshot = await getDocs(q);
        const orders = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              numeroPedido: data.numeroPedido,
              cliente: data.cliente,
              producto: data.producto,
              isbn: data.isbn,
              fechaPedido: data.fechaPedido,
              estado: data.estado,
            };
          })
          .slice(0, maxResults);
        return { success: true, data: { count: orders.length, orders } };
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
    },
    execute: async () => {
      try {
        const data = await cached("celesa_stats", async () => {
          const ref = collection(db, "celesa_orders");
          const estados = ["En curso", "Entregado", "Agotado", "Atrasado", "Pendiente"];
          const countPromises = estados.map(async (estado) => {
            const q = query(ref, where("estado", "==", estado));
            const snap = await getCountFromServer(q);
            return [estado, snap.data().count] as const;
          });
          const totalSnap = await getCountFromServer(query(ref));
          const counts = await Promise.all(countPromises);
          const byStatus: Record<string, number> = {};
          for (const [estado, count] of counts) {
            if (count > 0) byStatus[estado] = count;
          }
          return { total: totalSnap.data().count, byStatus };
        }, 5 * 60 * 1000); // 5 min TTL
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
