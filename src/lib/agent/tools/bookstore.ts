// src/lib/agent/tools/bookstore.ts
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const bookstoreTools: ToolDefinition[] = [
  {
    name: "listBookstoreRequests",
    description: "Lista las solicitudes de librerías, con filtro opcional por estado.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filtrar por estado de la solicitud (opcional)",
        },
      },
      required: [],
    },
    execute: async (params) => {
      try {
        const ref = collection(db, "bookstore_requests");
        const q = params.status
          ? query(ref, where("status", "==", params.status))
          : query(ref);
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
  {
    name: "updateBookstoreRequest",
    description: "Actualiza el estado de una solicitud de librería.",
    parameters: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "ID del documento de la solicitud",
        },
        status: {
          type: "string",
          description: "Nuevo estado para la solicitud",
        },
      },
      required: ["requestId", "status"],
    },
    execute: async (params) => {
      try {
        const ref = doc(db, "bookstore_requests", params.requestId as string);
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
