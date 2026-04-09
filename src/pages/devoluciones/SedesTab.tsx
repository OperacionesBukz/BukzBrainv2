import { useState, useCallback } from "react";
import { Loader2, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import FileUploadField from "./FileUploadField";
import { useDevolucionesConfig, useEnviarSedes } from "./hooks";
import { logDevolucion, crearTareaDevolucion } from "./api";
import { parseDevolucionFile } from "./parse-file";
import type { DevolucionItem, EnvioResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function SedesTab() {
  const [step, setStep] = useState<Step>("config");
  const [sede, setSede] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [codigoDevolucion, setCodigoDevolucion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [response, setResponse] = useState<EnvioResponse | null>(null);

  const { user } = useAuth();
  const { data: config, isLoading: configLoading } = useDevolucionesConfig();
  const mutation = useEnviarSedes();

  const canSubmit =
    sede && motivo && proveedorNombre.trim() && archivo && remitente;

  const handleSubmit = useCallback(async () => {
    if (!sede || !motivo || !proveedorNombre.trim() || !archivo || !remitente)
      return;

    let parsedItems: DevolucionItem[] = [];
    try {
      parsedItems = await parseDevolucionFile(archivo);
    } catch (e) {
      console.warn("[devoluciones] No se pudo parsear archivo:", e);
    }

    setStep("processing");
    mutation.mutate(
      { sede, motivo, proveedorNombre: proveedorNombre.trim(), archivo, remitente },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(`Email enviado a ${data.destinatario}`);
          setStep("results");
          const codigo = codigoDevolucion.trim();
          logDevolucion({
            tipo: "sede",
            destinatario: data.destinatario,
            correos: data.correos,
            motivo,
            proveedorNombre: proveedorNombre.trim(),
            ...(codigo ? { codigoDevolucion: codigo } : {}),
            nombreArchivo: archivo.name,
            asunto: data.asunto,
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "enviado",
            ...(parsedItems.length ? { items: parsedItems } : {}),
          });
          if (codigo) {
            crearTareaDevolucion({
              motivo,
              destinatario: data.destinatario,
              codigoDevolucion: codigo,
              createdBy: user?.email ?? "",
              items: parsedItems,
            }).catch((err) => console.error("[devoluciones] Error al crear tarea:", err));
          }
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar email",
          );
          setStep("config");
          const codigoErr = codigoDevolucion.trim();
          logDevolucion({
            tipo: "sede",
            destinatario: sede,
            correos: [],
            motivo,
            proveedorNombre: proveedorNombre.trim(),
            ...(codigoErr ? { codigoDevolucion: codigoErr } : {}),
            nombreArchivo: archivo.name,
            asunto: "",
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "error",
            detalle: err instanceof Error ? err.message : "Error desconocido",
          });
        },
      },
    );
  }, [sede, motivo, proveedorNombre, codigoDevolucion, archivo, remitente, mutation, user]);

  const handleReset = useCallback(() => {
    setStep("config");
    setSede("");
    setMotivo("");
    setProveedorNombre("");
    setCodigoDevolucion("");
    setArchivo(null);
    setResponse(null);
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sede destino</Label>
              <Select value={sede} onValueChange={setSede} disabled={configLoading}>
                <SelectTrigger>
                  {configLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                    </span>
                  ) : (
                    <SelectValue placeholder="Seleccionar sede" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {config?.sedes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo} disabled={configLoading}>
                <SelectTrigger>
                  {configLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                    </span>
                  ) : (
                    <SelectValue placeholder="Seleccionar motivo" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {config?.motivos_sedes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="proveedor-nombre">Nombre del proveedor</Label>
              <Input
                id="proveedor-nombre"
                value={proveedorNombre}
                onChange={(e) => setProveedorNombre(e.target.value)}
                placeholder="Ej: Penguin RandomHouse"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="codigo-devolucion-sedes">Código Devolución</Label>
              <Input
                id="codigo-devolucion-sedes"
                value={codigoDevolucion}
                onChange={(e) => setCodigoDevolucion(e.target.value)}
                placeholder="Ej: 001"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remitente-sedes">Remitente</Label>
              <Input
                id="remitente-sedes"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
              />
            </div>
          </div>

          <FileUploadField
            label="Archivo con los libros a devolver"
            description="Formatos aceptados: xlsx, xls, csv"
            accept=".xlsx,.xls,.csv"
            fileName={archivo?.name ?? null}
            onFileSelected={setArchivo}
            onClear={() => setArchivo(null)}
          />

          <Button onClick={handleSubmit} disabled={!canSubmit || configLoading}>
            Enviar correo a sede
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando email a la sede...
          </p>
        </div>
      )}

      {step === "results" && response && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Email enviado correctamente</span>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><span className="font-medium text-foreground">Destinatario:</span> {response.destinatario}</p>
              <p><span className="font-medium text-foreground">Correos:</span> {response.correos.join(", ")}</p>
              <p><span className="font-medium text-foreground">Asunto:</span> {response.asunto}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo envío
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
