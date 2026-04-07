// src/lib/agent/tools/dashboard.ts
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
        const data = await cached(`dashboard_summary_${userId}`, async () => {
          const [tasksSnap, requestsSnap, celesaCount] = await Promise.all([
            getDocs(query(
              collection(db, "user_tasks"),
              where("userId", "==", userId),
              where("status", "==", "todo")
            )),
            getDocs(query(
              collection(db, "leave_requests"),
              where("status", "==", "pending")
            )),
            getCountFromServer(query(collection(db, "celesa_orders"))),
          ]);
          return {
            pendingTasks: tasksSnap.size,
            pendingRequests: requestsSnap.size,
            totalOrders: celesaCount.data().count,
          };
        });
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "getDailyBriefing",
    description:
      "Genera un briefing completo del día: tareas pendientes del usuario, tareas vencidas, solicitudes de permiso pendientes, pedidos Celesa pendientes y solicitudes de librerías pendientes. Ideal cuando el usuario pide un resumen de su día.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (_params, userId) => {
      try {
        const data = await cached(`daily_briefing_${userId}`, async () => {
          const [
            personalTasksSnap,
            opsTasksSnap,
            leaveSnap,
            celesaSnap,
            bookstoreSnap,
          ] = await Promise.all([
            getDocs(query(
              collection(db, "user_tasks"),
              where("userId", "==", userId),
              where("status", "==", "todo")
            )),
            getDocs(query(
              collection(db, "tasks"),
              where("status", "==", "todo")
            )),
            getDocs(query(
              collection(db, "leave_requests"),
              where("status", "==", "pending")
            )),
            getDocs(query(
              collection(db, "celesa_orders"),
              where("estado", "==", "Pendiente")
            )),
            getDocs(query(
              collection(db, "bookstore_requests"),
              where("status", "==", "pending")
            )),
          ]);

          const now = new Date();
          const personalTasks = personalTasksSnap.docs.map((d) => {
            const dd = d.data();
            const dueDate = dd.dueDate?.toDate ? dd.dueDate.toDate() : dd.dueDate ? new Date(dd.dueDate) : null;
            return {
              title: dd.title,
              priority: dd.priority,
              dueDate: dueDate?.toISOString().split("T")[0] ?? null,
              overdue: dueDate ? dueDate < now : false,
            };
          });

          const opsTasks = opsTasksSnap.docs.map((d) => {
            const dd = d.data();
            return { title: dd.title, department: dd.department };
          });

          return {
            personalTasks: { items: personalTasks, count: personalTasks.length },
            operationsTasks: { count: opsTasks.length, byDepartment: opsTasks.reduce((acc: Record<string, number>, t) => { acc[t.department] = (acc[t.department] ?? 0) + 1; return acc; }, {}) },
            pendingLeaveRequests: leaveSnap.size,
            pendingCelesaOrders: celesaSnap.size,
            pendingBookstoreRequests: bookstoreSnap.size,
            overdueTasks: personalTasks.filter((t) => t.overdue).length,
          };
        });
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "getTeamWorkload",
    description:
      "Muestra la carga de trabajo del equipo: cantidad de tareas pendientes por usuario. Solo para admins.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      try {
        const data = await cached("team_workload", async () => {
          const [usersSnap, tasksSnap] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(query(collection(db, "user_tasks"), where("status", "==", "todo"))),
          ]);

          const userMap: Record<string, string> = {};
          usersSnap.docs.forEach((d) => {
            const dd = d.data();
            userMap[dd.email ?? d.id] = dd.displayName ?? dd.name ?? dd.email ?? d.id;
          });

          const workload: Record<string, { name: string; pending: number }> = {};
          tasksSnap.docs.forEach((d) => {
            const uid = d.data().userId as string;
            if (!workload[uid]) {
              workload[uid] = { name: userMap[uid] ?? uid, pending: 0 };
            }
            workload[uid].pending++;
          });

          const sorted = Object.values(workload).sort((a, b) => b.pending - a.pending);
          return { team: sorted, totalMembers: sorted.length };
        });
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "searchEverything",
    description:
      "Búsqueda universal: busca un término en tareas personales, tareas de operaciones, pedidos Celesa y solicitudes de librerías. Útil para encontrar todo lo relacionado con un cliente, producto o tema.",
    parameters: {
      type: "object",
      properties: {
        searchTerm: {
          type: "string",
          description: "Término a buscar (nombre de cliente, título de tarea, producto, etc.).",
        },
      },
      required: ["searchTerm"],
    },
    execute: async (params, userId) => {
      try {
        const term = (params.searchTerm as string).toLowerCase();

        // Use limited queries instead of downloading entire collections
        const [personalSnap, opsSnap, celesaSnap, bookstoreSnap] = await Promise.all([
          getDocs(query(collection(db, "user_tasks"), where("userId", "==", userId), firestoreLimit(100))),
          getDocs(query(collection(db, "tasks"), firestoreLimit(100))),
          getDocs(query(collection(db, "celesa_orders"), firestoreLimit(200))),
          getDocs(query(collection(db, "bookstore_requests"), firestoreLimit(100))),
        ]);

        const matchStr = (val: unknown) => typeof val === "string" && val.toLowerCase().includes(term);

        const personalTasks = personalSnap.docs
          .filter((d) => matchStr(d.data().title) || matchStr(d.data().notes))
          .slice(0, 10)
          .map((d) => ({ id: d.id, type: "tarea_personal", title: d.data().title, status: d.data().status }));

        const opsTasks = opsSnap.docs
          .filter((d) => matchStr(d.data().title) || matchStr(d.data().notes))
          .slice(0, 10)
          .map((d) => ({ id: d.id, type: "tarea_operaciones", title: d.data().title, department: d.data().department }));

        const celesaOrders = celesaSnap.docs
          .filter((d) => matchStr(d.data().cliente) || matchStr(d.data().producto) || matchStr(d.data().numeroPedido))
          .slice(0, 10)
          .map((d) => ({ id: d.id, type: "pedido_celesa", numeroPedido: d.data().numeroPedido, cliente: d.data().cliente, estado: d.data().estado }));

        const bookstoreReqs = bookstoreSnap.docs
          .filter((d) => {
            const data = d.data();
            if (matchStr(data.branch) || matchStr(data.note) || matchStr(data.userEmail)) return true;
            return (data.items as Array<{ name: string }>)?.some((item) => matchStr(item.name));
          })
          .slice(0, 10)
          .map((d) => ({ id: d.id, type: "solicitud_libreria", branch: d.data().branch, status: d.data().status }));

        const results = [...personalTasks, ...opsTasks, ...celesaOrders, ...bookstoreReqs];
        return { success: true, data: { searchTerm: term, results: results.slice(0, 30), totalFound: results.length } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
