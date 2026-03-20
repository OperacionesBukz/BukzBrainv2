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
        const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);
        const snapshot = await getDocs(q);
        const limit = params.limit ? Number(params.limit) : 20;
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
          .slice(0, limit);
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
        const ref = collection(db, "celesa_orders");
        const snapshot = await getDocs(ref);
        const byStatus: Record<string, number> = {};
        snapshot.docs.forEach((d) => {
          const estado = (d.data().estado as string) ?? "desconocido";
          byStatus[estado] = (byStatus[estado] ?? 0) + 1;
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
