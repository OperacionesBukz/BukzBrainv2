import { useState, useEffect, ReactNode } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  limit,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LeaveRequest } from "../requests/types";
import { RequestOrder } from "../bookstore/types";

export function useRequestsHubData() {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [bookstoreOrders, setBookstoreOrders] = useState<RequestOrder[]>([]);

  // Subscribe to leave_requests
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "leave_requests"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as LeaveRequest[];
      setLeaveRequests(docs);
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to bookstore_requests
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "bookstore_requests"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as RequestOrder[];
      setBookstoreOrders(docs);
    });
    return () => unsubscribe();
  }, [user]);

  // Actions for leave requests
  const updateRequestStatus = async (
    requestId: string,
    newStatus: "pending" | "approved" | "rejected"
  ) => {
    try {
      await updateDoc(doc(db, "leave_requests", requestId), {
        status: newStatus,
      });
      const statusLabels = {
        pending: "Pendiente",
        approved: "Aprobado",
        rejected: "Rechazado",
      };
      toast.success(`Estado actualizado a ${statusLabels[newStatus]}`);
    } catch (error: any) {
      toast.error("Error al actualizar el estado: " + error.message);
    }
  };

  const deleteRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, "leave_requests", requestId));
      toast.success("Solicitud eliminada correctamente");
    } catch (error: any) {
      toast.error("Error al eliminar la solicitud: " + error.message);
    }
  };

  // Actions for bookstore orders
  const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer."))
      return;
    setIsDeletingOrder(orderId);
    try {
      await deleteDoc(doc(db, "bookstore_requests", orderId));
      toast.success("Pedido eliminado correctamente");
    } catch (error: any) {
      toast.error("Error al eliminar el pedido: " + error.message);
    } finally {
      setIsDeletingOrder(null);
    }
  };

  // Helper: formatDate
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate();
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  return {
    leaveRequests,
    bookstoreOrders,
    updateRequestStatus,
    deleteRequest,
    handleDeleteOrder,
    isDeletingOrder,
    formatDate,
  };
}
