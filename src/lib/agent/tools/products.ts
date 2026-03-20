// src/lib/agent/tools/products.ts
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ToolDefinition } from "../types";

export const productTools: ToolDefinition[] = [
  {
    name: "searchProducts",
    description: "Busca productos por ISBN (si la búsqueda es numérica de 10-13 dígitos) o por prefijo de título.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Término de búsqueda: ISBN numérico o texto del título",
        },
        limit: {
          type: "string",
          description: "Número máximo de resultados (por defecto 10)",
        },
      },
      required: ["query"],
    },
    execute: async (params) => {
      try {
        const searchQuery = params.query as string;
        const limit = params.limit ? Number(params.limit) : 10;
        const ref = collection(db, "products");
        let q;

        if (/^\d{10,13}$/.test(searchQuery)) {
          q = query(ref, where("isbn", "==", searchQuery));
        } else {
          q = query(
            ref,
            where("title", ">=", searchQuery),
            where("title", "<=", searchQuery + "\uf8ff"),
            orderBy("title")
          );
        }

        const snapshot = await getDocs(q);
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
    name: "getProductInventory",
    description: "Obtiene los datos de inventario de un producto específico por su ID.",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "ID del documento del producto en Firestore",
        },
      },
      required: ["productId"],
    },
    execute: async (params) => {
      try {
        const ref = doc(db, "products", params.productId as string);
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) {
          return { success: false, error: "Producto no encontrado" };
        }
        const d = snapshot.data();
        return {
          success: true,
          data: {
            id: snapshot.id,
            title: d.title ?? null,
            stock: d.stock ?? null,
            isbn: d.isbn ?? null,
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
