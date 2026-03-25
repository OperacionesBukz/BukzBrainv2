import { useState, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CortesUpload from "./CortesUpload";
import DescuentoResultTable from "./DescuentoResultTable";
import { processDescuento, downloadBlob } from "./api";
import type { DescuentoRow } from "./types";

type Step = "config" | "processing" | "results";

function parseResultBlob(blob: Blob, pctEsperado: number): Promise<DescuentoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const rows: DescuentoRow[] = raw.map((r) => ({
          orderName: String(r["Order name"] ?? ""),
          sku: String(r["Product variant SKU"] ?? ""),
          productTitle: String(r["Product title"] ?? ""),
          vendor: String(r["Product vendor"] ?? ""),
          discountName: String(r["Discount name"] ?? ""),
          netItemsSold: Number(r["Net items sold"] ?? 0),
          pctEsperado,
          pctReal: Number(r["% Real"] ?? 0),
          detalle: String(r["Detalle"] ?? ""),
        }));

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsArrayBuffer(blob);
  });
}

export default function DescuentoTab() {
  const [step, setStep] = useState<Step>("config");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedRows, setProcessedRows] = useState<DescuentoRow[]>([]);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [porcentaje, setPorcentaje] = useState<number>(30);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setFileName(file.name.replace(/\.[^.]+$/, "_descuento.xlsx"));
  }, []);

  const handleProcess = useCallback(async () => {
    if (!selectedFile) return;

    setStep("processing");
    setIsProcessing(true);

    try {
      const blob = await processDescuento(selectedFile, porcentaje);
      setResultBlob(blob);

      const rows = await parseResultBlob(blob, porcentaje);
      setProcessedRows(rows);

      const conDescuento = rows.filter((r) => r.detalle === "Con descuento").length;
      toast.success(`Procesado: ${conDescuento} libro${conDescuento !== 1 ? "s" : ""} con descuento`);

      setStep("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error procesando archivo";
      toast.error(msg);
      setStep("config");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, porcentaje]);

  const handleDownload = useCallback(() => {
    if (resultBlob) {
      downloadBlob(resultBlob, fileName);
    }
  }, [resultBlob, fileName]);

  const handleReset = useCallback(() => {
    setStep("config");
    setProcessedRows([]);
    setResultBlob(null);
    setFileName("");
    setSelectedFile(null);
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pct">% Descuento esperado</Label>
              <Input
                id="pct"
                type="number"
                min={1}
                max={100}
                value={porcentaje}
                onChange={(e) => setPorcentaje(Number(e.target.value))}
                className="w-32"
              />
            </div>
            {selectedFile && (
              <Button onClick={handleProcess}>
                Procesar archivo
              </Button>
            )}
          </div>
          <CortesUpload onFileSelected={handleFileSelected} />
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Consultando pedidos en Shopify...
          </p>
          <p className="text-xs text-muted-foreground">
            Esto puede tardar unos segundos
          </p>
        </div>
      )}

      {step === "results" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {processedRows.length} filas procesadas — descuento esperado: {porcentaje}%
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo archivo
            </Button>
          </div>
          <DescuentoResultTable
            rows={processedRows}
            onDownload={handleDownload}
          />
        </>
      )}
    </div>
  );
}
