import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  limit as firestoreLimit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const taskTools: ToolDefinition[] = [
  {
    name: "createPersonalTask",
    description:
      "Crea una tarea personal para el usuario actual en la colección user_tasks.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título de la tarea.",
        },
        priority: {
          type: "string",
          enum: ["Baja", "Media", "Alta", "Urgente"],
          description: "Prioridad de la tarea. Por defecto: Media.",
        },
        dueDate: {
          type: "string",
          description: "Fecha límite en formato ISO 8601 (opcional).",
        },
      },
      required: ["title"],
    },
    execute: async (params, userId) => {
      try {
        const title = params.title as string;
        const priority = (params.priority as string) ?? "Media";
        const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;

        const docRef = await addDoc(collection(db, "user_tasks"), {
          title,
          priority,
          status: "todo",
          notes: "",
          subtasks: [],
          userId,
          createdAt: serverTimestamp(),
          order: Date.now(),
          ...(dueDate ? { dueDate } : {}),
        });

        return { success: true, data: { id: docRef.id, title, priority } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al crear tarea personal.",
        };
      }
    },
  },

  {
    name: "listPersonalTasks",
    description:
      "Lista las tareas personales del usuario actual. Permite filtrar por estado (todo/done).",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["todo", "done"],
          description: "Filtro opcional por estado de la tarea.",
        },
      },
      required: [],
    },
    execute: async (params, userId) => {
      try {
        const constraints = [where("userId", "==", userId)];
        if (params.status) {
          constraints.push(where("status", "==", params.status as string));
        }

        const q = query(collection(db, "user_tasks"), ...constraints);
        const snapshot = await getDocs(q);

        const tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { success: true, data: { tasks, count: tasks.length } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al listar tareas personales.",
        };
      }
    },
  },

  {
    name: "updatePersonalTask",
    description:
      "Actualiza el título, prioridad o estado de una tarea personal del usuario actual. Verifica que la tarea pertenezca al usuario antes de actualizar.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "ID del documento de la tarea en Firestore.",
        },
        title: {
          type: "string",
          description: "Nuevo título (opcional).",
        },
        priority: {
          type: "string",
          enum: ["Baja", "Media", "Alta", "Urgente"],
          description: "Nueva prioridad (opcional).",
        },
        status: {
          type: "string",
          enum: ["todo", "done"],
          description: "Nuevo estado (opcional).",
        },
      },
      required: ["taskId"],
    },
    execute: async (params, userId) => {
      try {
        const taskId = params.taskId as string;
        const taskRef = doc(db, "user_tasks", taskId);
        const taskDoc = await getDoc(taskRef);

        if (!taskDoc.exists()) {
          return { success: false, error: "Tarea no encontrada." };
        }

        if (taskDoc.data().userId !== userId) {
          return { success: false, error: "No tienes permiso para modificar esta tarea." };
        }

        const updates: Record<string, unknown> = {};
        if (params.title !== undefined) updates.title = params.title;
        if (params.priority !== undefined) updates.priority = params.priority;
        if (params.status !== undefined) updates.status = params.status;

        if (Object.keys(updates).length === 0) {
          return { success: false, error: "No se proporcionaron campos para actualizar." };
        }

        await updateDoc(taskRef, updates);
        return { success: true, data: { id: taskId, updated: updates } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al actualizar tarea personal.",
        };
      }
    },
  },

  {
    name: "assignTask",
    description:
      "Asigna una tarea personal a otro usuario (por email). Crea la tarea en user_tasks con userId igual al email del destinatario y registra quién la asignó.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título de la tarea a asignar.",
        },
        assignedTo: {
          type: "string",
          description: "Email del usuario al que se asigna la tarea.",
        },
        priority: {
          type: "string",
          enum: ["Baja", "Media", "Alta", "Urgente"],
          description: "Prioridad de la tarea. Por defecto: Media.",
        },
        dueDate: {
          type: "string",
          description: "Fecha límite en formato ISO 8601 (opcional).",
        },
      },
      required: ["title", "assignedTo"],
    },
    execute: async (params, userId) => {
      try {
        const title = params.title as string;
        const assignedTo = params.assignedTo as string;
        const priority = (params.priority as string) ?? "Media";
        const dueDate = params.dueDate ? new Date(params.dueDate as string) : null;

        const docRef = await addDoc(collection(db, "user_tasks"), {
          title,
          priority,
          status: "todo",
          notes: "",
          subtasks: [],
          userId: assignedTo,
          assignedTo,
          assignedBy: userId,
          createdAt: serverTimestamp(),
          order: Date.now(),
          ...(dueDate ? { dueDate } : {}),
        });

        return {
          success: true,
          data: { id: docRef.id, title, assignedTo, assignedBy: userId },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al asignar tarea.",
        };
      }
    },
  },

  {
    name: "createOperationsTask",
    description:
      "Crea una tarea en el tablero de operaciones (colección tasks) con un departamento y estado inicial.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título de la tarea de operaciones.",
        },
        department: {
          type: "string",
          enum: ["General", "Devolución", "SAC", "Operaciones"],
          description: "Departamento al que pertenece la tarea. Por defecto: General.",
        },
      },
      required: ["title"],
    },
    execute: async (params, userId) => {
      try {
        const title = params.title as string;
        const department = (params.department as string) ?? "General";

        const docRef = await addDoc(collection(db, "tasks"), {
          title,
          department,
          status: "todo",
          notes: "",
          subtasks: [],
          createdBy: userId,
          createdAt: serverTimestamp(),
          order: Date.now(),
        });

        return { success: true, data: { id: docRef.id, title, department } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al crear tarea de operaciones.",
        };
      }
    },
  },

  {
    name: "listOperationsTasks",
    description:
      "Lista las tareas del tablero de operaciones. Permite filtrar por departamento y/o estado.",
    parameters: {
      type: "object",
      properties: {
        department: {
          type: "string",
          enum: ["General", "Devolución", "SAC", "Operaciones"],
          description: "Filtro opcional por departamento.",
        },
        status: {
          type: "string",
          description: "Filtro opcional por estado de la tarea.",
        },
      },
      required: [],
    },
    execute: async (params, _userId) => {
      try {
        const constraints = [];
        if (params.department) {
          constraints.push(where("department", "==", params.department as string));
        }
        if (params.status) {
          constraints.push(where("status", "==", params.status as string));
        }

        const q = constraints.length > 0
          ? query(collection(db, "tasks"), ...constraints, firestoreLimit(50))
          : query(collection(db, "tasks"), firestoreLimit(50));

        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map((d) => {
          const data = d.data();
          return { id: d.id, title: data.title, department: data.department, status: data.status };
        });
        return { success: true, data: { tasks, count: tasks.length } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al listar tareas de operaciones.",
        };
      }
    },
  },

  {
    name: "deletePersonalTask",
    description:
      "Elimina una tarea personal del usuario actual. Verifica que la tarea pertenezca al usuario antes de borrarla. Usa esta herramienta solo cuando el usuario lo pida explícitamente.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "ID del documento de la tarea en Firestore.",
        },
      },
      required: ["taskId"],
    },
    execute: async (params, userId) => {
      try {
        const taskId = params.taskId as string;
        const taskRef = doc(db, "user_tasks", taskId);
        const taskDoc = await getDoc(taskRef);

        if (!taskDoc.exists()) {
          return { success: false, error: "Tarea no encontrada." };
        }

        if (taskDoc.data().userId !== userId) {
          return { success: false, error: "No tienes permiso para eliminar esta tarea." };
        }

        const title = taskDoc.data().title;
        await deleteDoc(taskRef);
        return { success: true, data: { id: taskId, title, deleted: true } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al eliminar tarea personal.",
        };
      }
    },
  },

  {
    name: "deleteOperationsTask",
    description:
      "Elimina una tarea del tablero de operaciones. Usa esta herramienta solo cuando el usuario lo pida explícitamente.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "ID del documento de la tarea en Firestore.",
        },
      },
      required: ["taskId"],
    },
    execute: async (params, _userId) => {
      try {
        const taskId = params.taskId as string;
        const taskRef = doc(db, "tasks", taskId);
        const taskDoc = await getDoc(taskRef);

        if (!taskDoc.exists()) {
          return { success: false, error: "Tarea no encontrada." };
        }

        const title = taskDoc.data().title;
        await deleteDoc(taskRef);
        return { success: true, data: { id: taskId, title, deleted: true } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al eliminar tarea de operaciones.",
        };
      }
    },
  },

  {
    name: "addNoteToTask",
    description:
      "Agrega una nota al campo 'notes' de una tarea personal del usuario actual.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID de la tarea." },
        note: { type: "string", description: "Texto de la nota a agregar." },
      },
      required: ["taskId", "note"],
    },
    execute: async (params, userId) => {
      try {
        const taskRef = doc(db, "user_tasks", params.taskId as string);
        const taskDoc = await getDoc(taskRef);
        if (!taskDoc.exists()) return { success: false, error: "Tarea no encontrada." };
        if (taskDoc.data().userId !== userId) return { success: false, error: "No tienes permiso." };

        const existing = (taskDoc.data().notes as string) || "";
        const updated = existing ? `${existing}\n${params.note}` : (params.note as string);
        await updateDoc(taskRef, { notes: updated });
        return { success: true, data: { id: params.taskId, notes: updated } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "addSubtaskToTask",
    description:
      "Agrega una subtarea a una tarea personal del usuario actual.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID de la tarea." },
        title: { type: "string", description: "Título de la subtarea." },
      },
      required: ["taskId", "title"],
    },
    execute: async (params, userId) => {
      try {
        const taskRef = doc(db, "user_tasks", params.taskId as string);
        const taskDoc = await getDoc(taskRef);
        if (!taskDoc.exists()) return { success: false, error: "Tarea no encontrada." };
        if (taskDoc.data().userId !== userId) return { success: false, error: "No tienes permiso." };

        const subtask = { id: crypto.randomUUID(), title: params.title as string, done: false };
        await updateDoc(taskRef, { subtasks: arrayUnion(subtask) });
        return { success: true, data: { id: params.taskId, subtask } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "updateOperationsTask",
    description:
      "Actualiza el título, departamento, notas o estado de una tarea del tablero de operaciones.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID de la tarea de operaciones." },
        title: { type: "string", description: "Nuevo título (opcional)." },
        department: {
          type: "string",
          enum: ["General", "Devolución", "SAC", "Operaciones"],
          description: "Nuevo departamento (opcional).",
        },
        status: { type: "string", enum: ["todo", "done"], description: "Nuevo estado (opcional)." },
        notes: { type: "string", description: "Nuevas notas (opcional)." },
      },
      required: ["taskId"],
    },
    execute: async (params) => {
      try {
        const taskId = params.taskId as string;
        const taskRef = doc(db, "tasks", taskId);
        const taskDoc = await getDoc(taskRef);
        if (!taskDoc.exists()) return { success: false, error: "Tarea no encontrada." };

        const updates: Record<string, unknown> = {};
        if (params.title !== undefined) updates.title = params.title;
        if (params.department !== undefined) updates.department = params.department;
        if (params.status !== undefined) updates.status = params.status;
        if (params.notes !== undefined) updates.notes = params.notes;

        if (Object.keys(updates).length === 0) {
          return { success: false, error: "No se proporcionaron campos para actualizar." };
        }

        await updateDoc(taskRef, updates);
        return { success: true, data: { id: taskId, updated: updates } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "getOverdueTasks",
    description:
      "Lista las tareas personales pendientes del usuario que tienen fecha límite vencida o que vencen esta semana.",
    parameters: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["overdue", "this_week", "all_with_dates"],
          description: "overdue = vencidas, this_week = vencen esta semana, all_with_dates = todas con fecha. Por defecto: overdue.",
        },
      },
      required: [],
    },
    execute: async (params, userId) => {
      try {
        const q = query(
          collection(db, "user_tasks"),
          where("userId", "==", userId),
          where("status", "==", "todo")
        );
        const snapshot = await getDocs(q);
        const now = new Date();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);

        const scope = (params.scope as string) ?? "overdue";
        const tasks = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((t: Record<string, unknown>) => {
            if (!t.dueDate) return scope === "all_with_dates" ? false : false;
            const dueDate = t.dueDate as { toDate?: () => Date };
            const due = dueDate.toDate ? dueDate.toDate() : new Date(t.dueDate as string);
            if (scope === "overdue") return due < now;
            if (scope === "this_week") return due <= endOfWeek;
            return true;
          })
          .map((t: Record<string, unknown>) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            dueDate: (() => { const d = t.dueDate as { toDate?: () => Date } | string | undefined; return d && typeof d === "object" && d.toDate ? d.toDate().toISOString() : d; })(),
          }));

        return { success: true, data: { tasks, count: tasks.length, scope } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "listUserTasks",
    description:
      "Lista las tareas personales de otro usuario por email. Solo disponible para admins.",
    parameters: {
      type: "object",
      properties: {
        userEmail: { type: "string", description: "Email del usuario cuyas tareas quieres ver." },
        status: { type: "string", enum: ["todo", "done"], description: "Filtro opcional por estado." },
      },
      required: ["userEmail"],
    },
    execute: async (params) => {
      try {
        const constraints = [where("userId", "==", params.userEmail as string)];
        if (params.status) {
          constraints.push(where("status", "==", params.status as string));
        }
        const q = query(collection(db, "user_tasks"), ...constraints);
        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map((d) => {
          const data = d.data();
          return { id: d.id, title: data.title, priority: data.priority, status: data.status };
        });
        return { success: true, data: { userEmail: params.userEmail, tasks, count: tasks.length } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
