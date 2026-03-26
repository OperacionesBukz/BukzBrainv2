import { useState, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import CortesUpload from "../operations/cortes/CortesUpload";
import CortesResultTable from "../operations/cortes/CortesResultTable";
import DescuentoResultTable from "../operations/cortes/DescuentoResultTable";
import { processCortes, processDescuento, downloadBlob } from "../operations/cortes/api";
import type { CortesRow, DescuentoRow } from "../operations/cortes/types";
import type { DiscountType } from "./types";

interface Props {
  onComplete: () => void;
}

type Step = "config" | "processing" | "results";

function parseCortesBlob(blob: Blob): Promise<CortesRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        resolve(raw.map((r) => ({
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
        })));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsArrayBuffer(blob);
  });
}

function parseDescuentoBlob(blob: Blob, pct: number): Promise<DescuentoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        resolve(raw.map((r) => ({
          orderName: String(r["Order name"] ?? ""),
          sku: String(r["Product variant SKU"] ?? ""),
          productTitle: String(r["Product title"] ?? ""),
          vendor: String(r["Product vendor"] ?? ""),
          discountName: String(r["Discount name"] ?? ""),
          netItemsSold: Number(r["Net items sold"] ?? 0),
          pctEsperado: pct,
          pctReal: Number(r["% Real"] ?? 0),
          detalle: String(r["Detalle"] ?? ""),
        })));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsArrayBuffer(blob);
  });
}

export default function PlanetaPhase2Descuentos({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("config");
  const [discountType, setDiscountType] = useState<DiscountType>("sin-descuento");
  const [porcentaje, setPorcentaje] = useState(30);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [cortesRows, setCortesRows] = useState<CortesRow[]>([]);
  const [descuentoRows, setDescuentoRows] = useState<DescuentoRow[]>([]);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setFileName(file.name.replace(/\.[^.]+$/, "_descuento.xlsx"));
  }, []);

  const handleProcess = useCallback(async () => {
    if (discountType === "sin-descuento") {
      onComplete();
      return;
    }

    if (!selectedFile) {
      toast.error("Selecciona un archivo primero");
      return;
    }

    setStep("processing");

    try {
      if (discountType === "3x2") {
        const blob = await processCortes(selectedFile);
        setResultBlob(blob);
        const rows = await parseCortesBlob(blob);
        setCortesRows(rows);
        const regalos = rows.filter((r) => r.detalle === "Regalo").length;
        toast.success(`Procesado: ${regalos} regalo${regalos !== 1 ? "s" : ""} identificado${regalos !== 1 ? "s" : ""}`);
      } else {
        const blob = await processDescuento(selectedFile, porcentaje);
        setResultBlob(blob);
        const rows = await parseDescuentoBlob(blob, porcentaje);
        setDescuentoRows(rows);
        const conDesc = rows.filter((r) => r.detalle === "Con descuento").length;
        toast.success(`Procesado: ${conDesc} libro${conDesc !== 1 ? "s" : ""} con descuento`);
      }

      setStep("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error procesando archivo";
      toast.error(msg);
      setStep("config");
    }
  }, [selectedFile, discountType, porcentaje, onComplete]);

  const handleDownload = useCallback(() => {
    if (resultBlob) downloadBlob(resultBlob, fileName);
  }, [resultBlob, fileName]);

  const handleReset = useCallback(() => {
    setStep("config");
    setCortesRows([]);
    setDescuentoRows([]);
    setResultBlob(null);
    setSelectedFile(null);
    setFileName("");
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de descuento</Label>
            <RadioGroup value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3x2" id="dt-3x2" />
                <Label htmlFor="dt-3x2" className="font-normal">3x2</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="porcentaje" id="dt-pct" />
                <Label htmlFor="dt-pct" className="font-normal">% Descuento</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sin-descuento" id="dt-none" />
                <Label htmlFor="dt-none" className="font-normal">Sin descuento este mes</Label>
              </div>
            </RadioGroup>
          </div>

          {discountType === "porcentaje" && (
            <div className="space-y-1.5">
              <Label htmlFor="pct-planeta">% Descuento esperado</Label>
              <Input
                id="pct-planeta"
                type="number"
                min={1}
                max={100}
                value={porcentaje}
                onChange={(e) => setPorcentaje(Number(e.target.value))}
                className="w-32"
              />
            </div>
          )}

          {discountType !== "sin-descuento" && (
            <CortesUpload onFileSelected={handleFileSelected} />
          )}

          <Button onClick={handleProcess}>
            {discountType === "sin-descuento" ? "Continuar sin descuento →" : "Procesar archivo"}
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Consultando pedidos en Shopify...</p>
          <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
        </div>
      )}

      {step === "results" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {discountType === "3x2" ? `${cortesRows.length} filas procesadas` : `${descuentoRows.length} filas procesadas — descuento esperado: ${porcentaje}%`}
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reiniciar
            </Button>
          </div>

          {discountType === "3x2" ? (
            <CortesResultTable rows={cortesRows} onDownload={handleDownload} />
          ) : (
            <DescuentoResultTable rows={descuentoRows} onDownload={handleDownload} />
          )}

          <Button variant="outline" onClick={onComplete}>
            Continuar a Enviar Correo →
          </Button>
        </>
      )}
    </div>
  );
}
