import { useState, useCallback } from "react";
import { Loader2, RotateCcw, CheckCircle2, Mail, AlertTriangle } from "lucide-react";
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
import { useEnviarCorteIndividual } from "./hooks";
import { MESES } from "./types";
import type { IndividualResponse } from "./api";

type Step = "config" | "processing" | "results";

export default function CorteIndividualTab() {
  const [step, setStep] = useState<Step>("config");
  const [ventasFile, setVentasFile] = useState<File | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [correo, setCorreo] = useState("");
  const [correoCc, setCorreoCc] = useState("");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [response, setResponse] = useState<IndividualResponse | null>(null);

  const mutation = useEnviarCorteIndividual();

  const canSubmit = ventasFile && proveedor && correo && mes && anio && remitente;

  const handleSubmit = useCallback(async () => {
    if (!ventasFile || !proveedor || !correo || !mes || !anio || !remitente) return;

    setStep("processing");

    mutation.mutate(
      {
        ventasFile,
        proveedor,
        correo,
        correoCc,
        mes,
        anio,
        remitente,
      },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(`Corte enviado a ${data.proveedor} (${data.correo})`);
          setStep("results");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar corte individual",
          );
          setStep("config");
        },
      },
    );
  }, [ventasFile, proveedor, correo, correoCc, mes, anio, remitente, mutation]);

  const handleReset = useCallback(() => {
    setStep("config");
    setVentasFile(null);
    setProveedor("");
    setCorreo("");
    setCorreoCc("");
    setMes("");
    setResponse(null);
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <FileUploadField
            label="Archivo de Ventas"
            description={
              <span>
                Columnas requeridas:{" "}
                {["product_title", "variant_sku", "product_vendor", "pos_location_name", "net_quantity"].map((col) => (
                  <code key={col} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] mr-1">{col}</code>
                ))}
              </span>
            }
            fileName={ventasFile?.name ?? null}
            onFileSelected={setVentasFile}
            onClear={() => setVentasFile(null)}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="proveedor">Proveedor</Label>
              <Input
                id="proveedor"
                placeholder="Nombre del proveedor"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="correo">Correo</Label>
              <Input
                id="correo"
                type="email"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="correo-cc">Correos CC</Label>
              <Input
                id="correo-cc"
                placeholder="Separar con punto y coma (;)"
                value={correoCc}
                onChange={(e) => setCorreoCc(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <Label htmlFor="anio-individual">Año</Label>
              <Input
                id="anio-individual"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remitente-individual">Remitente</Label>
              <Input
                id="remitente-individual"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Enviar Corte
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando corte individual...
          </p>
          <p className="text-xs text-muted-foreground">
            Esto puede tardar unos segundos
          </p>
        </div>
      )}

      {step === "results" && response && (
        <div className="space-y-5">
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="space-y-3 flex-1">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Corte enviado exitosamente
                </h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-800 dark:text-green-200">
                      Proveedor:
                    </span>
                    <span className="text-green-700 dark:text-green-300">
                      {response.proveedor}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-800 dark:text-green-200">
                      Correo:
                    </span>
                    <span className="text-green-700 dark:text-green-300">
                      {response.correo}
                    </span>
                  </div>
                  {response.correo_cc.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-green-800 dark:text-green-200">
                        CC:
                      </span>
                      <span className="text-green-700 dark:text-green-300">
                        {response.correo_cc.join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-800 dark:text-green-200">
                      Asunto:
                    </span>
                    <span className="text-green-700 dark:text-green-300">
                      {response.asunto}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-800 dark:text-green-200">
                      Filas procesadas:
                    </span>
                    <span className="text-green-700 dark:text-green-300">
                      {response.filas_procesadas}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {response.filter_applied === false && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                No se encontraron filas para el proveedor "{response.proveedor}" en el archivo. Se enviaron todas las filas del archivo.
              </p>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Nuevo envío
          </Button>
        </div>
      )}
    </div>
  );
}
