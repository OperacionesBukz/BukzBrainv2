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
import { createNotification } from "@/lib/notifications";
import { LeaveRequest } from "../requests/types";
import { RequestOrder, OrderStatus } from "../bookstore/types";

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

      // Fire-and-forget notification to the requesting user
      const request = leaveRequests.find((r) => r.id === requestId);
      if (request && request.userEmail && (newStatus === "approved" || newStatus === "rejected")) {
        const statusText = newStatus === "approved" ? "aprobada" : "rechazada";
        createNotification({
          userId: request.userEmail,
          type: newStatus === "approved" ? "leave_request_approved" : "leave_request_rejected",
          title: `Solicitud ${statusText}`,
          message: `Tu solicitud de permiso ha sido ${statusText}`,
          resourcePath: "/requests",
        }).catch((err) => console.warn("[notifications] Error:", err));
      }
    } catch (error) {
      toast.error("Error al actualizar el estado: " + (error instanceof Error ? error.message : "Error desconocido"));
    }
  };

  const deleteRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, "leave_requests", requestId));
      toast.success("Solicitud eliminada correctamente");
    } catch (error) {
      toast.error("Error al eliminar la solicitud: " + (error instanceof Error ? error.message : "Error desconocido"));
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
    } catch (error) {
      toast.error("Error al eliminar el pedido: " + (error instanceof Error ? error.message : "Error desconocido"));
    } finally {
      setIsDeletingOrder(null);
    }
  };

  const handleStatusChangeOrder = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, "bookstore_requests", orderId), { status: newStatus });
      toast.success("Estado actualizado");
    } catch (error) {
      toast.error("Error al actualizar estado: " + (error instanceof Error ? error.message : "Error desconocido"));
    }
  };

  // Helper: formatDate
  const formatDate = (timestamp: { toDate: () => Date } | null | undefined) => {
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
    handleStatusChangeOrder,
    isDeletingOrder,
    formatDate,
  };
}
