import { useCallback, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";

import FileUploadCard from "./reposicion/FileUploadCard";
import ConfigurationPanel from "./reposicion/ConfigurationPanel";
import ResultsView from "./reposicion/ResultsView";
import { detectSedes } from "./reposicion/csv-parser";
import { calculateReplenishment } from "./reposicion/replenishment-engine";
import type { SedeInfo, ReplenishmentResult } from "./reposicion/types";

type Step = "upload" | "results";

export default function Reposicion() {
  const [step, setStep] = useState<Step>("upload");

  // File state
  const [salesText, setSalesText] = useState("");
  const [salesFileName, setSalesFileName] = useState("");
  const [salesError, setSalesError] = useState("");
  const [inventoryText, setInventoryText] = useState("");
  const [inventoryFileName, setInventoryFileName] = useState("");
  const [inventoryError, setInventoryError] = useState("");

  // Config state
  const [sedes, setSedes] = useState<SedeInfo[]>([]);
  const [selectedSede, setSelectedSede] = useState("");
  const [leadTime, setLeadTime] = useState(14);
  const [isProcessing, setIsProcessing] = useState(false);

  // Results state
  const [result, setResult] = useState<ReplenishmentResult | null>(null);

  const bothFilesLoaded = !!salesText && !!inventoryText;

  const handleSalesLoaded = useCallback((text: string, fileName: string) => {
    setSalesText(text);
    setSalesFileName(fileName);
    setSalesError("");
    toast.success("Archivo de ventas cargado");
  }, []);

  const handleInventoryLoaded = useCallback((text: string, fileName: string) => {
    try {
      const detectedSedes = detectSedes(text);
      if (detectedSedes.length === 0) {
        setInventoryError("No se detectaron sedes en el archivo. Verifica el formato.");
        toast.error("No se detectaron sedes en el archivo");
        return;
      }
      setInventoryText(text);
      setInventoryFileName(fileName);
      setInventoryError("");
      setSedes(detectedSedes);
      if (detectedSedes.length === 1) {
        setSelectedSede(detectedSedes[0].label);
      }
      toast.success(`Archivo de inventario cargado (${detectedSedes.length} sede${detectedSedes.length > 1 ? "s" : ""} detectada${detectedSedes.length > 1 ? "s" : ""})`);
    } catch {
      setInventoryError("Error al leer el archivo de inventario");
      toast.error("Error al leer el archivo de inventario");
    }
  }, []);

  const handleGenerate = useCallback(() => {
    setIsProcessing(true);
    // Use setTimeout to not block UI during heavy computation
    setTimeout(() => {
      try {
        const res = calculateReplenishment(salesText, inventoryText, selectedSede, leadTime);
        setResult(res);
        setStep("results");
        toast.success(`Análisis completado: ${res.stats.totalProducts} productos analizados`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error procesando datos");
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  }, [salesText, inventoryText, selectedSede, leadTime]);

  const handleReset = useCallback(() => {
    setSalesText("");
    setSalesFileName("");
    setSalesError("");
    setInventoryText("");
    setInventoryFileName("");
    setInventoryError("");
    setSedes([]);
    setSelectedSede("");
    setLeadTime(14);
    setResult(null);
    setStep("upload");
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reposición de Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Modelo de reposición por sede y proveedor
          </p>
        </div>
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
              1
            </div>
            <span className="text-sm font-medium">Cargar archivos CSV</span>
            {bothFilesLoaded && (
              <>
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground text-sm font-semibold ml-3">
                  2
                </div>
                <span className="text-sm font-medium">Configurar y generar</span>
              </>
            )}
          </div>

          {/* Upload cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileUploadCard
              title="Archivo de Ventas"
              hint="Arrastra aquí o haz clic — Sales by Product (.csv)"
              isLoaded={!!salesText}
              fileName={salesFileName}
              error={salesError}
              onFileLoaded={handleSalesLoaded}
            />
            <FileUploadCard
              title="Archivo de Inventario"
              hint="Arrastra aquí o haz clic — Export de Inventory (.csv)"
              isLoaded={!!inventoryText}
              fileName={inventoryFileName}
              error={inventoryError}
              onFileLoaded={handleInventoryLoaded}
            />
          </div>

          {/* Configuration panel */}
          {bothFilesLoaded && (
            <ConfigurationPanel
              sedes={sedes}
              selectedSede={selectedSede}
              leadTime={leadTime}
              isProcessing={isProcessing}
              onSedeChange={setSelectedSede}
              onLeadTimeChange={setLeadTime}
              onGenerate={handleGenerate}
            />
          )}
        </div>
      )}

      {step === "results" && result && (
        <ResultsView result={result} sede={selectedSede} onReset={handleReset} />
      )}
    </div>
  );
}
