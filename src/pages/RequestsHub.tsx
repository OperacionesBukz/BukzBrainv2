import { useState } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, XCircle, Clock4, List, Calendar, Plus, Palmtree, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRequestsHubData } from "./requests-hub/useRequestsHubData";
import RequestsHubKpiCards from "./requests-hub/RequestsHubKpiCards";
import RequestsTracking from "./requests/RequestsTracking";
import RequestsCalendar from "./requests-hub/RequestsCalendar";
import BookstoreOrderHistory from "./bookstore/BookstoreOrderHistory";
import AdminAddPermissionDialog from "./requests-hub/AdminAddPermissionDialog";
import type { RequestOrder } from "./bookstore/types";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "active":
      return <Palmtree className="h-4 w-4 text-cyan-500" />;
    case "finished":
      return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
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
    case "active":
      return (
        <Badge className="bg-cyan-500/10 text-cyan-600 border-cyan-200">
          En Vacaciones
        </Badge>
      );
    case "finished":
      return (
        <Badge
          variant="secondary"
          className="bg-muted text-muted-foreground border-muted-foreground/20"
        >
          Finalizado
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

const viewOptions = [
  { id: "list", label: "Lista", icon: List },
  { id: "calendar", label: "Calendario", icon: Calendar },
];

const RequestsHub = () => {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("permisos");
  const [viewMode, setViewMode] = useState("list");
  const [selectedOrder, setSelectedOrder] = useState<RequestOrder | null>(null);
  const [addPermissionOpen, setAddPermissionOpen] = useState(false);

  const {
    leaveRequests,
    bookstoreOrders,
    updateRequestStatus,
    deleteRequest,
    handleDeleteOrder,
    handleStatusChangeOrder,
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
        <TabsList>
          {[
            { value: "permisos", label: "Permisos", icon: Palmtree },
            { value: "pedidos", label: "Pedidos", icon: ShoppingBag },
          ].map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <RequestsHubKpiCards
        leaveRequests={leaveRequests}
        bookstoreOrders={bookstoreOrders}
      />

      {activeTab === "permisos" && (
        <div className="animate-in fade-in duration-300 space-y-4">
          <div className="flex justify-end items-center gap-2">
            <Button size="sm" onClick={() => setAddPermissionOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar Permiso
            </Button>
            <ViewSwitcher
              options={viewOptions}
              current={viewMode}
              onSwitch={setViewMode}
            />
          </div>

          {viewMode === "list" ? (
            <RequestsTracking
              requests={leaveRequests}
              isOperations={true}
              isMobile={isMobile}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              updateRequestStatus={updateRequestStatus}
              deleteRequest={deleteRequest}
            />
          ) : (
            <RequestsCalendar requests={leaveRequests} />
          )}
        </div>
      )}

      {activeTab === "pedidos" && (
        <div className="animate-in fade-in duration-300">
          <BookstoreOrderHistory
            orders={bookstoreOrders}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            handleStatusChange={handleStatusChangeOrder}
            handleDeleteOrder={handleDeleteOrder}
            isDeletingOrder={isDeletingOrder}
            isMobile={isMobile}
            formatDate={formatDate}
          />
        </div>
      )}

      <AdminAddPermissionDialog
        open={addPermissionOpen}
        onOpenChange={setAddPermissionOpen}
      />
    </div>
  );
};

export default RequestsHub;
