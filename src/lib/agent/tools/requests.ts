// src/lib/agent/tools/requests.ts
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const requestTools: ToolDefinition[] = [
  {
    name: "createLeaveRequest",
    description: "Crea una solicitud de permiso o ausencia para el usuario actual.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Tipo de permiso (vacaciones, enfermedad, personal, etc.)",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio en formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin en formato YYYY-MM-DD",
        },
        reason: {
          type: "string",
          description: "Motivo o descripción opcional de la solicitud",
        },
      },
      required: ["type", "startDate", "endDate"],
    },
    execute: async (params, userId) => {
      try {
        const ref = collection(db, "leave_requests");
        const docRef = await addDoc(ref, {
          userId,
          type: params.type,
          startDate: params.startDate,
          endDate: params.endDate,
          reason: params.reason ?? null,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { success: true, data: { id: docRef.id } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
  {
    name: "listLeaveRequests",
    description: "Lista las solicitudes de permiso del usuario actual, con filtro opcional por estado.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "approved", "rejected"],
          description: "Filtrar por estado de la solicitud (opcional)",
        },
      },
      required: [],
    },
    execute: async (params, userId) => {
      try {
        const ref = collection(db, "leave_requests");
        const constraints = [where("userId", "==", userId)];
        if (params.status) {
          constraints.push(where("status", "==", params.status));
        }
        const q = query(ref, ...constraints);
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
  {
    name: "updateLeaveRequestStatus",
    description: "Actualiza el estado de una solicitud de permiso (aprobar o rechazar).",
    parameters: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "ID del documento de la solicitud",
        },
        status: {
          type: "string",
          enum: ["approved", "rejected"],
          description: "Nuevo estado de la solicitud",
        },
      },
      required: ["requestId", "status"],
    },
    execute: async (params) => {
      try {
        const ref = doc(db, "leave_requests", params.requestId as string);
        await updateDoc(ref, {
          status: params.status,
          updatedAt: serverTimestamp(),
        });
        return { success: true, data: { requestId: params.requestId, status: params.status } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
