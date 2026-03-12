import { useState } from "react";
import { Navigate } from "react-router-dom";
import { CalendarDays, Store, CheckCircle2, XCircle, Clock4 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRequestsHubData } from "./requests-hub/useRequestsHubData";
import RequestsHubKpiCards from "./requests-hub/RequestsHubKpiCards";
import RequestsTracking from "./requests/RequestsTracking";
import BookstoreOrderHistory from "./bookstore/BookstoreOrderHistory";
import type { RequestOrder } from "./bookstore/types";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock4 className="h-4 w-4 text-amber-500" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
          Aprobado
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          variant="destructive"
          className="bg-destructive/10 text-destructive border-destructive/20"
        >
          Rechazado
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className="bg-amber-500/10 text-amber-700 dark:text-amber-600 border-amber-200"
        >
          Pendiente
        </Badge>
      );
  }
};

const RequestsHub = () => {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("permisos");
  const [selectedOrder, setSelectedOrder] = useState<RequestOrder | null>(null);

  const {
    leaveRequests,
    bookstoreOrders,
    updateRequestStatus,
    deleteRequest,
    handleDeleteOrder,
    isDeletingOrder,
    formatDate,
  } = useRequestsHubData();

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          Hub Solicitudes
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Seguimiento centralizado de solicitudes de permisos y pedidos de librerías
        </p>
      </div>

      <RequestsHubKpiCards
        leaveRequests={leaveRequests}
        bookstoreOrders={bookstoreOrders}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="permisos" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Permisos y Vacaciones
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="gap-2">
            <Store className="h-4 w-4" />
            Pedidos Librerías
          </TabsTrigger>
        </TabsList>

        <TabsContent value="permisos" className="mt-0 animate-in fade-in duration-300">
          <RequestsTracking
            requests={leaveRequests}
            isOperations={true}
            isMobile={isMobile}
            getStatusIcon={getStatusIcon}
            getStatusBadge={getStatusBadge}
            updateRequestStatus={updateRequestStatus}
            deleteRequest={deleteRequest}
          />
        </TabsContent>

        <TabsContent value="pedidos" className="mt-0 animate-in fade-in duration-300">
          <BookstoreOrderHistory
            orders={bookstoreOrders}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            handleDeleteOrder={handleDeleteOrder}
            isDeletingOrder={isDeletingOrder}
            isMobile={isMobile}
            formatDate={formatDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequestsHub;
