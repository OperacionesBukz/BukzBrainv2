import { useState, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";
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
import FileUploadField from "./FileUploadField";
import ResultadosTable from "./ResultadosTable";
import { useEnviarCortesNoVentas } from "./hooks";
import { MESES } from "./types";
import type { NoVentasResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function CortesNoVentasTab() {
  const [step, setStep] = useState<Step>("config");
  const [provFile, setProvFile] = useState<File | null>(null);
  const [estadoFile, setEstadoFile] = useState<File | null>(null);
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [firma, setFirma] = useState(
    "Sebastian Barrios - Analista de Operaciones",
  );
  const [response, setResponse] = useState<NoVentasResponse | null>(null);

  const mutation = useEnviarCortesNoVentas();

  const canSubmit = provFile && estadoFile && mes && anio && remitente && firma;

  const handleSubmit = useCallback(async () => {
    if (!provFile || !estadoFile || !mes || !anio || !remitente || !firma)
      return;

    setStep("processing");

    mutation.mutate(
      {
        proveedoresFile: provFile,
        estadoFile,
        mes,
        anio,
        remitente,
        firma,
      },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(
            `Envío completado: ${data.resumen.enviados} notificaciones enviadas`,
          );
          setStep("results");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "Error al enviar notificaciones",
          );
          setStep("config");
        },
      },
    );
  }, [provFile, estadoFile, mes, anio, remitente, firma, mutation]);

  const handleReset = useCallback(() => {
    setStep("config");
    setProvFile(null);
    setEstadoFile(null);
    setResponse(null);
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <FileUploadField
              label="Archivo de Proveedores"
              description="Columnas requeridas: Proveedores, Correo"
              fileName={provFile?.name ?? null}
              onFileSelected={setProvFile}
              onClear={() => setProvFile(null)}
            />
            <FileUploadField
              label="Estado de Envío (proveedores con ventas)"
              description="Archivo generado en el tab de Cortes Ventas (estado_envio.xlsx del ZIP)"
              fileName={estadoFile?.name ?? null}
              onFileSelected={setEstadoFile}
              onClear={() => setEstadoFile(null)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Mes</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="anio-nv">Año</Label>
              <Input
                id="anio-nv"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remitente-nv">Remitente</Label>
              <Input
                id="remitente-nv"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="firma-nv">Firma</Label>
              <Input
                id="firma-nv"
                value={firma}
                onChange={(e) => setFirma(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Enviar Notificaciones
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando notificaciones de no ventas...
          </p>
          <p className="text-xs text-muted-foreground">
            Esto puede tardar unos minutos
          </p>
        </div>
      )}

      {step === "results" && response && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {response.resultados.length} proveedores procesados
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo envío
            </Button>
          </div>
          <ResultadosTable
            resultados={response.resultados}
            resumen={response.resumen}
          />
        </>
      )}
    </div>
  );
}
