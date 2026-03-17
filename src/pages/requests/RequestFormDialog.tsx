import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StringDatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestType, RequestFormState, requestTypeConfig } from "./types";

interface RequestFormDialogProps {
  dialogType: RequestType | null;
  setDialogType: (type: RequestType | null) => void;
  form: RequestFormState;
  setForm: (form: RequestFormState) => void;
  submitRequest: () => void;
  isMobile: boolean;
  isOperations: boolean;
  emailRecipient: string;
  setEmailRecipient: (value: string) => void;
  activeConfig: typeof requestTypeConfig[number] | undefined;
}

const RequestFormDialog = ({
  dialogType,
  setDialogType,
  form,
  setForm,
  submitRequest,
  isMobile,
  isOperations,
  emailRecipient,
  setEmailRecipient,
  activeConfig,
}: RequestFormDialogProps) => {
  return (
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
                      <StringDatePicker
                        value={form.startDate}
                        onChange={(val) => setForm({ ...form, startDate: val })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fecha Fin *</label>
                      <StringDatePicker
                        value={form.endDate}
                        onChange={(val) => setForm({ ...form, endDate: val })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reingreso *</label>
                      <StringDatePicker
                        value={form.returnDate}
                        onChange={(val) => setForm({ ...form, returnDate: val })}
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
                    <StringDatePicker
                      value={form.startDate}
                      onChange={(val) => setForm({ ...form, startDate: val, endDate: val })}
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
                      <StringDatePicker
                        value={form.startDate}
                        onChange={(val) => setForm({ ...form, startDate: val })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-foreground font-medium">Fecha Fin *</label>
                      <StringDatePicker
                        value={form.endDate}
                        onChange={(val) => setForm({ ...form, endDate: val })}
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
        <DialogFooter className="mt-6 pt-4 border-t flex-col sm:flex-row gap-4">
          {/* Dropdown para usuario operaciones */}
          {isOperations && (
            <div className="flex items-center gap-2 mr-auto">
              <label className="text-sm text-muted-foreground font-medium">Enviar a:</label>
              <Select value={emailRecipient} onValueChange={setEmailRecipient}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rh@bukz.co">rh@bukz.co</SelectItem>
                  <SelectItem value="operaciones@bukz.co">operaciones@bukz.co</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="ghost" size="lg" onClick={() => setDialogType(null)}>
              Cancelar
            </Button>
            <Button size="lg" onClick={submitRequest}>Enviar Solicitud</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestFormDialog;
