import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, Palmtree, Briefcase, Ban, Cake, History, CheckCircle2, XCircle, Clock4, Search, ArrowRight, Trash2, Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RequestType, LeaveRequest, RequestFormState, requestTypeConfig } from "./requests/types";
import RequestFormDialog from "./requests/RequestFormDialog";
import RequestsTracking from "./requests/RequestsTracking";

const Requests = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [dialogType, setDialogType] = useState<RequestType | null>(null);
  const [activeTab, setActiveTab] = useState("new-request");
  const [emailRecipient, setEmailRecipient] = useState("rh@bukz.co");
  const [form, setForm] = useState<RequestFormState>({
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

  const { isAdmin } = useAuth();
  const isOperations = isAdmin;

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
      await addDoc(collection(db, "leave_requests"), {
        type: dialogType,
        ...form,
        status: "pending",
        createdAt: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
      });

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
            email_body: body,
            to_email: emailRecipient
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
          <RequestsTracking
            requests={requests}
            isOperations={isOperations}
            isMobile={isMobile}
            getStatusIcon={getStatusIcon}
            getStatusBadge={getStatusBadge}
            updateRequestStatus={updateRequestStatus}
            deleteRequest={deleteRequest}
          />
        </TabsContent>
      </Tabs>

      {/* Popup form dialog */}
      <RequestFormDialog
        dialogType={dialogType}
        setDialogType={setDialogType}
        form={form}
        setForm={setForm}
        submitRequest={submitRequest}
        isMobile={isMobile}
        isOperations={isOperations}
        emailRecipient={emailRecipient}
        setEmailRecipient={setEmailRecipient}
        activeConfig={activeConfig}
      />
    </div>
  );
};

export default Requests;
