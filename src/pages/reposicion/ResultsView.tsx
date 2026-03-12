import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, RotateCcw, Package } from "lucide-react";
import { toast } from "sonner";
import StatCards from "./StatCards";
import VendorSummaryTable from "./VendorSummaryTable";
import ProductDetailTable from "./ProductDetailTable";
import { generateReplenishmentZip, downloadBlob } from "./excel-generator";
import type { ReplenishmentResult } from "./types";

interface ResultsViewProps {
  result: ReplenishmentResult;
  sede: string;
  onReset: () => void;
}

export default function ResultsView({ result, sede, onReset }: ResultsViewProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateReplenishmentZip(result, sede);
      const safeSede = sede.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "").trim();
      downloadBlob(blob, `Pedidos_${safeSede}_${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success("ZIP descargado correctamente");
    } catch {
      toast.error("Error al generar el ZIP");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <StatCards stats={result.stats} />

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Descargar Pedidos por Proveedor</div>
              <div className="text-sm text-muted-foreground">
                ZIP con {result.stats.vendorsWithOrders} archivos de pedido + 1 archivo de Análisis
                de Inventario
              </div>
            </div>
          </div>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Descargar ZIP
          </Button>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={onReset}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Nuevo análisis (otra sede u otros datos)
      </Button>

      <VendorSummaryTable vendors={result.vendors} />
      <ProductDetailTable products={result.products} />
    </div>
  );
}
