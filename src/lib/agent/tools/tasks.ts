import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
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
          ? query(collection(db, "tasks"), ...constraints)
          : query(collection(db, "tasks"));

        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { success: true, data: { tasks, count: tasks.length } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Error al listar tareas de operaciones.",
        };
      }
    },
  },
];
