// src/lib/agent/tools/bookstore.ts
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
  {
    name: "createBookstoreRequest",
    description:
      "Crea una solicitud de librería con una lista de productos, sede y nota opcional.",
    parameters: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description: "Nombre de la sede (ej: 'Sede Norte', 'Sede Centro').",
        },
        items: {
          type: "array",
          description: "Lista de productos solicitados. Cada item tiene name (nombre) y quantity (cantidad).",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre del producto." },
              quantity: { type: "number", description: "Cantidad solicitada." },
            },
            required: ["name", "quantity"],
          },
        },
        note: {
          type: "string",
          description: "Nota u observación adicional (opcional).",
        },
      },
      required: ["branch", "items"],
    },
    execute: async (params, userId) => {
      try {
        const items = (params.items as Array<{ name: string; quantity: number }>).map((item) => ({
          productId: "",
          name: item.name,
          code: "",
          quantity: item.quantity,
        }));
        const docRef = await addDoc(collection(db, "bookstore_requests"), {
          branch: params.branch,
          userEmail: userId,
          items,
          note: (params.note as string) ?? "",
          status: "pending",
          createdAt: serverTimestamp(),
        });
        return { success: true, data: { id: docRef.id, branch: params.branch, itemCount: items.length } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
