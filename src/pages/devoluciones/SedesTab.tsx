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
import FileUploadField from "./FileUploadField";
import { useDevolucionesConfig, useEnviarSedes } from "./hooks";
import type { EnvioResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function SedesTab() {
  const [step, setStep] = useState<Step>("config");
  const [sede, setSede] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [response, setResponse] = useState<EnvioResponse | null>(null);

  const { data: config, isLoading: configLoading } = useDevolucionesConfig();
  const mutation = useEnviarSedes();

  const canSubmit =
    sede && motivo && proveedorNombre.trim() && archivo && remitente;

  const handleSubmit = useCallback(() => {
    if (!sede || !motivo || !proveedorNombre.trim() || !archivo || !remitente)
      return;

    setStep("processing");
    mutation.mutate(
      { sede, motivo, proveedorNombre: proveedorNombre.trim(), archivo, remitente },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(`Email enviado a ${data.destinatario}`);
          setStep("results");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar email",
          );
          setStep("config");
        },
      },
    );
  }, [sede, motivo, proveedorNombre, archivo, remitente, mutation]);

  const handleReset = useCallback(() => {
    setStep("config");
    setSede("");
    setMotivo("");
    setProveedorNombre("");
    setArchivo(null);
    setResponse(null);
  }, []);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sede destino</Label>
              <Select value={sede} onValueChange={setSede}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sede" />
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
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo" />
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

          <div className="grid gap-4 sm:grid-cols-2">
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

          <Button onClick={handleSubmit} disabled={!canSubmit}>
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
