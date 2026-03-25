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
  {
    name: "getProductsByCategory",
    description:
      "Lista productos filtrados por categoría. Útil para buscar todos los productos de una categoría específica.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Nombre de la categoría para filtrar.",
        },
        limit: {
          type: "string",
          description: "Máximo de resultados (por defecto 20).",
        },
      },
      required: ["category"],
    },
    execute: async (params) => {
      try {
        const ref = collection(db, "products");
        const q = query(ref, where("category", "==", params.category as string));
        const snapshot = await getDocs(q);
        const maxResults = params.limit ? Number(params.limit) : 20;
        const data = snapshot.docs
          .map((d) => {
            const pd = d.data();
            return { id: d.id, title: pd.title ?? pd.name, isbn: pd.isbn, category: pd.category, stock: pd.stock };
          })
          .slice(0, maxResults);
        return { success: true, data: { category: params.category, products: data, count: data.length } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
  {
    name: "listProductCategories",
    description: "Lista todas las categorías de productos disponibles.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      try {
        const snapshot = await getDocs(collection(db, "product_categories"));
        const categories = snapshot.docs.map((d) => ({ id: d.id, name: d.data().name }));
        return { success: true, data: { categories, count: categories.length } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];
