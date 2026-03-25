import { useState, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import CortesUpload from "./CortesUpload";
import CortesResultTable from "./CortesResultTable";
import { processCortes, downloadBlob } from "./api";
import type { CortesRow } from "./types";

type Step = "upload" | "processing" | "results";

function parseResultBlob(blob: Blob): Promise<CortesRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const rows: CortesRow[] = raw.map((r) => ({
          orderName: String(r["Order name"] ?? ""),
          sku: String(r["Product variant SKU"] ?? ""),
          productTitle: String(r["Product title"] ?? ""),
          vendor: String(r["Product vendor"] ?? ""),
          posLocation: String(r["POS location name"] ?? ""),
          salesChannel: String(r["Sales channel"] ?? ""),
          discountName: String(r["Discount name"] ?? ""),
          netItemsSold: Number(r["Net items sold"] ?? 0),
          detalle: String(r["Detalle"] ?? ""),
          udsConDescuento: Number(r["Uds con descuento"] ?? 0),
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

export default function CortesTab() {
  const [step, setStep] = useState<Step>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedRows, setProcessedRows] = useState<CortesRow[]>([]);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFileSelected = useCallback(async (file: File) => {
    setStep("processing");
    setIsProcessing(true);
    setFileName(file.name.replace(/\.[^.]+$/, "_procesado.xlsx"));

    try {
      const blob = await processCortes(file);
      setResultBlob(blob);

      const rows = await parseResultBlob(blob);
      setProcessedRows(rows);

      const regalos = rows.filter((r) => r.detalle === "Regalo").length;
      toast.success(`Procesado: ${regalos} regalo${regalos !== 1 ? "s" : ""} identificado${regalos !== 1 ? "s" : ""}`);

      setStep("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error procesando archivo";
      toast.error(msg);
      setStep("upload");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (resultBlob) {
      downloadBlob(resultBlob, fileName);
    }
  }, [resultBlob, fileName]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setProcessedRows([]);
    setResultBlob(null);
    setFileName("");
  }, []);

  return (
    <div className="space-y-5">
      {step === "upload" && (
        <CortesUpload onFileSelected={handleFileSelected} />
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
              {processedRows.length} filas procesadas
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo archivo
            </Button>
          </div>
          <CortesResultTable
            rows={processedRows}
            onDownload={handleDownload}
          />
        </>
      )}
    </div>
  );
}
