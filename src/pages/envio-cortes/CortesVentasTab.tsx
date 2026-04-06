import { useState, useCallback } from "react";
import { Loader2, RotateCcw, Download } from "lucide-react";
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
import { useEnviarCortesVentas } from "./hooks";
import { downloadZipFromBase64 } from "./api";
import { MESES } from "./types";
import type { VentasResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function CortesVentasTab() {
  const [step, setStep] = useState<Step>("config");
  const [provFile, setProvFile] = useState<File | null>(null);
  const [ventasFile, setVentasFile] = useState<File | null>(null);
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [response, setResponse] = useState<VentasResponse | null>(null);

  const mutation = useEnviarCortesVentas();

  const canSubmit = provFile && ventasFile && mes && anio && remitente;

  const handleSubmit = useCallback(async () => {
    if (!provFile || !ventasFile || !mes || !anio || !remitente) return;

    setStep("processing");

    mutation.mutate(
      {
        proveedoresFile: provFile,
        ventasFile,
        mes,
        anio,
        remitente,
      },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(
            `Envío completado: ${data.resumen.enviados} enviados, ${data.resumen.errores} errores`,
          );
          setStep("results");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar cortes",
          );
          setStep("config");
        },
      },
    );
  }, [provFile, ventasFile, mes, anio, remitente, mutation]);

  const handleDownloadZip = useCallback(() => {
    if (response?.zip_base64) {
      downloadZipFromBase64(
        response.zip_base64,
        `envios_y_proveedores_${mes}.zip`,
      );
    }
  }, [response, mes]);

  const handleReset = useCallback(() => {
    setStep("config");
    setProvFile(null);
    setVentasFile(null);
    setResponse(null);
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <FileUploadField
              label="Archivo de Proveedores"
              description={
                <span>
                  Columnas requeridas:{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">Proveedores</code>{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">Correo</code>
                </span>
              }
              fileName={provFile?.name ?? null}
              onFileSelected={setProvFile}
              onClear={() => setProvFile(null)}
            />
            <FileUploadField
              label="Archivo de Ventas Mensuales"
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
              <Label htmlFor="anio">Año</Label>
              <Input
                id="anio"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remitente">Remitente</Label>
              <Input
                id="remitente"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Enviar Cortes
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando cortes por email...
          </p>
          <p className="text-xs text-muted-foreground">
            Esto puede tardar varios minutos dependiendo de la cantidad de
            proveedores
          </p>
        </div>
      )}

      {step === "results" && response && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {response.resultados.length} proveedores procesados
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadZip}>
                <Download className="h-4 w-4 mr-2" />
                Descargar ZIP
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Nuevo envío
              </Button>
            </div>
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
