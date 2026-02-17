import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, Palmtree, Briefcase, Ban, Cake, History, CheckCircle2, XCircle, Clock4, Search, ArrowRight, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

type RequestType = "vacation" | "paid-leave" | "unpaid-leave" | "birthday-leave";

interface LeaveRequest {
  id: string;
  type: RequestType;
  fullName?: string;
  idDocument?: string;
  role?: string;
  branch?: string;
  phoneNumber?: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  returnDate?: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
  userId: string;
  userEmail: string;
}


const requestTypeConfig: {
  value: RequestType;
  label: string;
  description: string;
  icon: typeof Palmtree;
  color: string;
}[] = [
    { value: "vacation", label: "Vacaciones", description: "Tiempo libre para viajes o descanso", icon: Palmtree, color: "text-primary-foreground" },
    { value: "paid-leave", label: "Permiso Remunerado", description: "Permiso personal o por enfermedad", icon: Briefcase, color: "text-primary-foreground" },
    { value: "unpaid-leave", label: "Permiso No Remunerado", description: "Tiempo libre sin pago", icon: Ban, color: "text-primary-foreground" },
    { value: "birthday-leave", label: "Día de Cumpleaños", description: "Día libre por tu cumpleaños", icon: Cake, color: "text-primary-foreground" },
  ];

const Requests = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [dialogType, setDialogType] = useState<RequestType | null>(null);
  const [activeTab, setActiveTab] = useState("new-request");
  const [form, setForm] = useState({
    fullName: "",
    idDocument: "",
    role: "",
    branch: "",
    phoneNumber: "",
    supervisor: "",
    startDate: "",
    endDate: "",
    returnDate: "",
    reason: "",
  });

  const isOperations = user?.email === "operaciones@bukz.co";

  // Fetch requests from Firestore
  useEffect(() => {
    if (!user) return;

    let q;
    if (isOperations) {
      // Operations sees ALL requests
      q = query(collection(db, "leave_requests"), orderBy("createdAt", "desc"));
    } else {
      // Regular users only see THEIR requests
      q = query(
        collection(db, "leave_requests"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaveRequest[];
      setRequests(docs);
    });

    return () => unsubscribe();
  }, [user, isOperations]);

  const submitRequest = async () => {
    if (!form.startDate || !form.endDate || !dialogType || !user) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    try {
      const newRequestData = {
        type: dialogType,
        ...form,
        status: "pending",
        createdAt: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
      };

      await addDoc(collection(db, "leave_requests"), newRequestData);

      // Trigger email sending via PythonAnywhere API (Free fallback)
      const requestLabel = requestTypeConfig.find(t => t.value === dialogType)?.label;

      let subject = `${requestLabel} - ${form.fullName} - ${form.branch}`;
      let body = "";

      if (dialogType === "vacation") {
        subject = `Solicitud de Vacaciones - ${form.fullName} - ${form.branch}`;
        body = `Respetados señores,<br><br>

Por medio de la presente, yo <b>${form.fullName}</b>, identificado(a) con <b>${form.idDocument}</b>, quien se desempeña como <b>${form.role}</b> en la sede <b>${form.branch}</b>, solicito la autorización para disfrutar de mis vacaciones correspondientes al período laboral comprendido entre:<br><br>

* Fecha inicio de vacaciones: <b>${form.startDate}</b><br>
* Fecha finalización de vacaciones: <b>${form.endDate}</b><br><br>

Me comprometo a retomar mis labores el <b>${form.returnDate}</b>, de acuerdo con lo establecido en la normatividad vigente y las políticas internas de la empresa.<br><br>

Esta solicitud se realiza con el conocimiento y aval de mi jefe inmediato, <b>${form.supervisor}</b>.<br><br>

Agradezco su atención y quedo pendiente de la confirmación.<br><br>

Cordialmente,<br>
<b>${form.fullName}</b><br>
${form.role}<br>
${form.branch}<br>
Celular: ${form.phoneNumber}<br>
${form.idDocument}`;
      } else if (dialogType === "birthday-leave") {
        subject = `Solicitud de día de cumpleaños - ${form.fullName} - ${form.branch}`;
        body = `Respetados señores,<br><br>

Por medio de la presente, yo <b>${form.fullName}</b>, identificado(a) con <b>${form.idDocument}</b>, quien se desempeña como <b>${form.role}</b> en la sede <b>${form.branch}</b>, solicito la autorización para disfrutar de día de cumpleaños, de acuerdo con el siguiente detalle:<br><br>

Día de cumpleaños<br>
* Fecha: <b>${form.startDate}</b><br><br>

En caso de aplicar, dejo constancia de que tengo claridad sobre las condiciones del permiso solicitado y su impacto conforme a la normatividad vigente y las políticas internas de la empresa.<br><br>

Esta solicitud se realiza con el conocimiento y aval de mi jefe inmediato, <b>${form.supervisor}</b>.<br><br>

Agradezco su atención y quedo pendiente de la confirmación.<br><br>

Cordialmente,<br>
${form.fullName}<br>
${form.role}<br>
${form.branch}<br>
Celular: ${form.phoneNumber}<br>
${form.idDocument}`;
      } else if (dialogType === "paid-leave") {
        subject = `Solicitud de Permiso Remunerado - ${form.fullName} - ${form.branch}`;
        body = `Respetados señores,<br><br>

Por medio de la presente, yo <b>${form.fullName}</b>, identificado(a) con <b>${form.idDocument}</b>, quien se desempeña como <b>${form.role}</b> en la sede <b>${form.branch}</b>, solicito la autorización para un <b>permiso remunerado</b> por el motivo de: <b>${form.reason}</b>, de acuerdo con el siguiente detalle:<br><br>

* Fecha inicio: <b>${form.startDate}</b><br>
* Fecha finalización: <b>${form.endDate}</b><br><br>

Dejo constancia de que tengo claridad sobre las condiciones del permiso solicitado y su impacto conforme a la normatividad vigente y las políticas internas de la empresa.<br><br>

Esta solicitud se realiza con el conocimiento y aval de mi jefe inmediato, <b>${form.supervisor}</b>.<br><br>

Agradezco su atención y quedo pendiente de la confirmación.<br><br>

Cordialmente,<br>
<b>${form.fullName}</b><br>
${form.role}<br>
${form.branch}<br>
Celular: ${form.phoneNumber}<br>
${form.idDocument}`;
      } else if (dialogType === "unpaid-leave") {
        subject = `Solicitud de Permiso No Remunerado - ${form.fullName} - ${form.branch}`;
        body = `Respetados señores,<br><br>

Por medio de la presente, yo <b>${form.fullName}</b>, identificado(a) con <b>${form.idDocument}</b>, quien se desempeña como <b>${form.role}</b> en la sede <b>${form.branch}</b>, solicito la autorización para un <b>permiso no remunerado</b> por el motivo de: <b>${form.reason}</b>, de acuerdo con el siguiente detalle:<br><br>

* Fecha inicio: <b>${form.startDate}</b><br>
* Fecha finalización: <b>${form.endDate}</b><br><br>

Dejo constancia de que tengo claridad sobre las condiciones del permiso solicitado y su impacto conforme a la normatividad vigente y las políticas internas de la empresa.<br><br>

Esta solicitud se realiza con el conocimiento y aval de mi jefe inmediato, <b>${form.supervisor}</b>.<br><br>

Agradezco su atención y quedo pendiente de la confirmación.<br><br>

Cordialmente,<br>
<b>${form.fullName}</b><br>
${form.role}<br>
${form.branch}<br>
Celular: ${form.phoneNumber}<br>
${form.idDocument}`;
      } else {
        // Generic template for other leaves
        body = `Solicitud de <b>${requestLabel}</b> enviada por <b>${form.fullName}</b>.<br><br>
        
<b>Motivo:</b> ${form.reason}<br>
<b>Desde:</b> ${form.startDate}<br>
<b>Hasta:</b> ${form.endDate}<br>
<b>Jefe Inmediato:</b> ${form.supervisor}<br>
<b>Celular:</b> ${form.phoneNumber}`;
      }

      try {
        await fetch("https://Operaciones.pythonanywhere.com/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            userEmail: user.email,
            type_label: requestLabel,
            subject: subject,
            email_body: body
          }),
        });
        toast.success("Solicitud enviada y notificación enviada por correo");
      } catch (emailError) {
        console.error("Error al enviar notificación:", emailError);
        toast.success("Solicitud enviada (la notificación por correo falló)");
      }

      setForm({
        fullName: "",
        idDocument: "",
        role: "",
        branch: "",
        phoneNumber: "",
        supervisor: "",
        startDate: "",
        endDate: "",
        returnDate: "",
        reason: "",
      });
      setDialogType(null);
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast.error("Error al enviar la solicitud: " + error.message);
    }
  };

  const deleteRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, "leave_requests", requestId));
      toast.success("Solicitud eliminada correctamente");
    } catch (error: any) {
      console.error("Error deleting request:", error);
      toast.error("Error al eliminar la solicitud: " + error.message);
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: "pending" | "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "leave_requests", requestId), {
        status: newStatus,
      });
      const statusLabels = {
        pending: "Pendiente",
        approved: "Aprobado",
        rejected: "Rechazado"
      };
      toast.success(`Estado actualizado a ${statusLabels[newStatus]}`);
    } catch (error: any) {
      console.error("Error updating request status:", error);
      toast.error("Error al actualizar el estado: " + error.message);
    }
  };

  const activeConfig = requestTypeConfig.find((t) => t.value === dialogType);
  const months2026 = Array.from({ length: 12 }, (_, i) => new Date(2026, i));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "rejected": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock4 className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Aprobado</Badge>;
      case "rejected": return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Rechazado</Badge>;
      default: return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-600 border-amber-200">Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Solicitudes</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Envía y gestiona tus permisos y vacaciones
          </p>
        </div>

        {isOperations && (
          <div className="flex items-center gap-2 bg-foreground/10 text-foreground px-4 py-2 rounded-full border border-foreground/20 shadow-sm backdrop-blur-sm">
            <Search className="h-4 w-4" />
            <span className="text-sm font-semibold">Modo Administrador (Operaciones)</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-8">
          <TabsTrigger value="new-request" className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Solicitud
          </TabsTrigger>
          {isOperations && (
            <TabsTrigger value="tracking" className="gap-2">
              <History className="h-4 w-4" />
              Seguimiento
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="new-request" className="space-y-8 mt-0 animate-in fade-in duration-500">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {requestTypeConfig.map((type) => (
              <button
                key={type.value}
                onClick={() => setDialogType(type.value)}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <type.icon className="h-6 w-6 text-foreground" />
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-medium text-foreground">{type.label}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{type.description}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-theme">
                  Solicitar <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>

          {/* Year Calendar 2026 */}
          <div className="pt-4">
            <h2 className="text-lg font-medium text-foreground mb-4">Calendario Institucional 2026</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6">
              {months2026.map((month) => (
                <div key={month.getMonth()} className="rounded-xl border border-border bg-card p-2 shadow-sm overflow-hidden">
                  <Calendar
                    mode="single"
                    month={month}
                    className="p-0 pointer-events-auto w-full"
                    classNames={{
                      months: "flex flex-col w-full",
                      month: "space-y-1 w-full",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-xs font-semibold",
                      nav: "hidden",
                      table: "w-full border-collapse table-fixed",
                      head_row: "flex w-full",
                      head_cell: "text-muted-foreground flex-1 text-center font-normal text-xs",
                      row: "flex w-full mt-0.5",
                      cell: "flex-1 aspect-square text-center text-xs p-0 relative",
                      day: "h-full w-full p-0 font-normal text-xs hover:bg-muted rounded-md inline-flex items-center justify-center",
                      day_today: "bg-primary text-primary-foreground font-semibold",
                      day_outside: "text-muted-foreground opacity-30",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_selected: "bg-primary text-primary-foreground",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="mt-0 animate-in slide-in-from-bottom-4 duration-500">
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {!isMobile ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                      {isOperations && <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solicitante</th>}
                      <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Celular</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fechas</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivo</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviado</th>
                      {isOperations && <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 md:px-6 py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <History className="h-8 w-8 opacity-20" />
                            <p>No hay solicitudes registradas.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                    requests.map((request) => (
                      <tr key={request.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted text-foreground dark:bg-primary/10 dark:text-primary">
                              {request.type === 'vacation' ? <Palmtree className="h-4 w-4" /> :
                                request.type === 'birthday-leave' ? <Cake className="h-4 w-4" /> :
                                  <Briefcase className="h-4 w-4" />}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {requestTypeConfig.find(t => t.value === request.type)?.label}
                            </span>
                          </div>
                        </td>
                        {isOperations && (
                          <td className="px-4 md:px-6 py-3 md:py-4">
                            <div className="flex flex-col text-sm">
                              <span className="font-medium text-foreground">{request.fullName || "Sin nombre"}</span>
                              <span className="text-xs text-muted-foreground">{request.branch || "Sin sede"}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-foreground">
                          {request.phoneNumber || "—"}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col text-sm">
                            <span className="text-foreground">{request.startDate} al {request.endDate}</span>
                            {request.returnDate && <span className="text-xs text-muted-foreground italic">Reingreso: {request.returnDate}</span>}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-foreground max-w-xs truncate">
                          {request.reason || "—"}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-2">
                            {isOperations ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity outline-none">
                                    {getStatusIcon(request.status)}
                                    {getStatusBadge(request.status)}
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[140px]">
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, "pending")} className="gap-2">
                                    <Clock4 className="h-4 w-4 text-amber-500" /> Pendiente
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, "approved")} className="gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aprobar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, "rejected")} className="gap-2 text-destructive focus:text-destructive">
                                    <XCircle className="h-4 w-4" /> Rechazar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <>
                                {getStatusIcon(request.status)}
                                {getStatusBadge(request.status)}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-muted-foreground">
                          {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleDateString() : "Reciente"}
                        </td>
                        {isOperations && (
                          <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRequest(request.id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              ) : (
                <div className="space-y-3 p-3">
                  {requests.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                      <History className="h-8 w-8 opacity-20" />
                      <p>No hay solicitudes registradas.</p>
                    </div>
                  ) : (
                    requests.map((request) => (
                      <div key={request.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                        {/* Header del card: tipo + badge status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-muted text-foreground dark:bg-primary/10 dark:text-primary">
                              {request.type === 'vacation' ? <Palmtree className="h-4 w-4" /> :
                                request.type === 'birthday-leave' ? <Cake className="h-4 w-4" /> :
                                  <Briefcase className="h-4 w-4" />}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {requestTypeConfig.find(t => t.value === request.type)?.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isOperations ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity outline-none">
                                    {getStatusIcon(request.status)}
                                    {getStatusBadge(request.status)}
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[140px]">
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, "pending")} className="gap-2">
                                    <Clock4 className="h-4 w-4 text-amber-500" /> Pendiente
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, "approved")} className="gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aprobar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, "rejected")} className="gap-2 text-destructive focus:text-destructive">
                                    <XCircle className="h-4 w-4" /> Rechazar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <>
                                {getStatusIcon(request.status)}
                                {getStatusBadge(request.status)}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Info del solicitante (solo si isOperations) */}
                        {isOperations && (
                          <div className="text-sm">
                            <span className="font-medium text-foreground">{request.fullName || "Sin nombre"}</span>
                            <span className="text-xs text-muted-foreground block">{request.branch || "Sin sede"}</span>
                          </div>
                        )}

                        {/* Detalles */}
                        <div className="text-sm space-y-1.5">
                          <div>
                            <span className="text-muted-foreground text-xs">Fechas:</span>{" "}
                            <span className="font-medium text-foreground">{request.startDate} - {request.endDate}</span>
                            {request.returnDate && <span className="text-xs text-muted-foreground block italic">Reingreso: {request.returnDate}</span>}
                          </div>
                          {request.phoneNumber && (
                            <div>
                              <span className="text-muted-foreground text-xs">Teléfono:</span>{" "}
                              <span className="text-foreground">{request.phoneNumber}</span>
                            </div>
                          )}
                          {request.reason && (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              <span className="font-medium">Motivo:</span> {request.reason}
                            </div>
                          )}
                        </div>

                        {/* Footer: fecha creación + botón eliminar */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">
                            Enviado: {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleDateString() : "Reciente"}
                          </span>
                          {isOperations && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRequest(request.id)}
                              className="h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Popup form dialog */}
      <Dialog open={!!dialogType} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className={cn(
          isMobile
            ? "w-full h-full max-w-full max-h-full m-0 rounded-none p-4"
            : "sm:max-w-2xl lg:max-w-3xl"
        )}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {activeConfig && <activeConfig.icon className={cn("h-6 w-6", activeConfig.color)} />}
              Nueva solicitud: {activeConfig?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:gap-6 py-3 md:py-4 overflow-y-auto max-h-[calc(100vh-160px)] md:max-h-[75vh] px-1">
            {/* Personal Information Structure - Now for ALL request types */}
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-foreground font-medium">Nombre Completo *</label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-foreground font-medium">Documento de Identidad *</label>
                  <Input
                    value={form.idDocument}
                    onChange={(e) => setForm({ ...form, idDocument: e.target.value })}
                    placeholder="Ej: 1234567890"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-foreground font-medium">Cargo *</label>
                  <Input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Ej: Analista/Librero"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-foreground font-medium">Sede *</label>
                  <Select
                    value={form.branch}
                    onValueChange={(value) => setForm({ ...form, branch: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecciona una sede" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bukz Las Lomas">Bukz Las Lomas</SelectItem>
                      <SelectItem value="Bukz Viva Envigado">Bukz Viva Envigado</SelectItem>
                      <SelectItem value="Bukz Museo">Bukz Museo</SelectItem>
                      <SelectItem value="Bukz Cedi">Bukz Cedi</SelectItem>
                      <SelectItem value="Bukz Administrativo">Bukz Administrativo</SelectItem>
                      <SelectItem value="Bukz Bogota 109">Bukz Bogota 109</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-foreground font-medium">Jefe Inmediato *</label>
                  <Input
                    value={form.supervisor}
                    onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
                    placeholder="Ej: María González"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-foreground font-medium">Celular *</label>
                  <Input
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                    placeholder="Ej: 3001234567"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-2">
                {dialogType === "vacation" && (
                  <div className="space-y-6">
                    <h4 className="text-base font-semibold">Período de Vacaciones</h4>
                    <div className="grid gap-4 sm:grid-cols-3 text-center sm:text-left">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fecha Inicio *</label>
                        <Input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fecha Fin *</label>
                        <Input
                          type="date"
                          value={form.endDate}
                          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reingreso *</label>
                        <Input
                          type="date"
                          value={form.returnDate}
                          onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 text-sm text-foreground leading-relaxed shadow-sm">
                      <strong className="text-primary">Nota:</strong> Las solicitudes de vacaciones deben realizarse con al menos 15 días de anticipación para garantizar la cobertura de la operación.
                    </div>
                  </div>
                )}

                {dialogType === "birthday-leave" && (
                  <div className="space-y-6">
                    <h4 className="text-base font-semibold">Fecha del Día de Cumpleaños</h4>
                    <div className="space-y-2">
                      <label className="text-sm text-foreground font-medium">Fecha *</label>
                      <Input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })}
                        className="max-w-[240px] h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Selecciona la fecha en la que deseas tomar tu día de cumpleaños
                      </p>
                    </div>

                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4 text-sm text-amber-800 dark:text-amber-200 leading-relaxed shadow-sm">
                      <strong className="text-amber-700 dark:text-amber-400">Nota:</strong> El día de cumpleaños es un beneficio otorgado por la empresa. Tu confirmación será enviada a tu jefe directo y al correo de tu sede. Asegúrate de solicitarlo con la debida anticipación.
                    </div>
                  </div>
                )}

                {(dialogType === "paid-leave" || dialogType === "unpaid-leave") && (
                  <div className="space-y-6">
                    <h4 className="text-base font-semibold">Detalles del Permiso</h4>
                    <div className="space-y-2">
                      <label className="text-sm text-foreground font-medium">Motivo del Permiso *</label>
                      <Input
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="Ej: Trámites personales, cita médica, etc."
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm text-foreground font-medium">Fecha Inicio *</label>
                        <Input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-foreground font-medium">Fecha Fin *</label>
                        <Input
                          type="date"
                          value={form.endDate}
                          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-900 dark:text-blue-200 leading-relaxed shadow-sm">
                      <strong className="text-blue-600 dark:text-blue-400">Importante:</strong> Los permisos deben ser justificados y contar con el aval del jefe inmediato para su aprobación final por RRHH.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 pt-4 border-t">
            <Button variant="ghost" size="lg" onClick={() => setDialogType(null)}>
              Cancelar
            </Button>
            <Button size="lg" onClick={submitRequest}>Enviar Solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Requests;
