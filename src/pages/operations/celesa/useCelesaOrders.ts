import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { CelesaOrder, CelesaStatus } from "./types";
import { businessDaysSince } from "./types";

export function useCelesaOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CelesaOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "celesa_orders"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as CelesaOrder[];
        setOrders(list);
        setLoading(false);

        // Auto-marcar como Atrasado pedidos con más de 30 días hábiles
        list.forEach((order) => {
          if (
            order.fechaPedido &&
            order.estado !== "Agotado" &&
            order.estado !== "Entregado" &&
            order.estado !== "Atrasado" &&
            businessDaysSince(order.fechaPedido) > 30
          ) {
            updateDoc(doc(db, "celesa_orders", order.id), {
              estado: "Atrasado",
              updatedAt: serverTimestamp(),
            });
          }
        });
      },
      (error) => {
        console.error("Error en celesa_orders:", error);
        toast.error("Error al sincronizar pedidos Celesa");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addOrder = async (data: {
    numeroPedido: string;
    cliente: string;
    producto: string;
    isbn: string;
    fechaPedido: string;
    estado: CelesaStatus;
  }) => {
    try {
      await addDoc(collection(db, "celesa_orders"), {
        ...data,
        createdBy: user?.email || "desconocido",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Pedido agregado");
    } catch (error) {
      console.error("Error adding celesa order:", error);
      toast.error("Error al agregar pedido: " + (error instanceof Error ? error.message : "Error desconocido"));
    }
  };

  const updateOrder = async (
    id: string,
    updates: Partial<Omit<CelesaOrder, "id" | "createdAt" | "createdBy">>
  ) => {
    try {
      await updateDoc(doc(db, "celesa_orders", id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating celesa order:", error);
      toast.error("Error al actualizar pedido");
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, "celesa_orders", id));
      toast.success("Pedido eliminado");
    } catch (error) {
      console.error("Error deleting celesa order:", error);
      toast.error("Error al eliminar pedido");
    }
  };

  return { orders, loading, addOrder, updateOrder, deleteOrder };
}
