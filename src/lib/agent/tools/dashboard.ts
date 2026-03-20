// src/lib/agent/tools/dashboard.ts
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const dashboardTools: ToolDefinition[] = [
  {
    name: "getDashboardSummary",
    description: "Obtiene un resumen del dashboard: tareas pendientes, solicitudes de permiso pendientes y total de pedidos Celesa.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (_params, userId) => {
      try {
        const [tasksSnap, requestsSnap, celesaSnap] = await Promise.all([
          getDocs(query(
            collection(db, "user_tasks"),
            where("userId", "==", userId),
            where("status", "==", "todo")
          )),
          getDocs(query(
            collection(db, "leave_requests"),
            where("status", "==", "pending")
          )),
          getDocs(collection(db, "celesa_orders")),
        ]);

        return {
          success: true,
          data: {
            pendingTasks: tasksSnap.size,
            pendingRequests: requestsSnap.size,
            totalOrders: celesaSnap.size,
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
