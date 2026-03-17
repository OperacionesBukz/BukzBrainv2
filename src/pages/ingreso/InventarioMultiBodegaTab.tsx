import { useEffect, useState } from "react";
import { Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocations, useSalesLoad, useSalesStatus, useInventoryExcel } from "./hooks";
import { MAIN_WAREHOUSES } from "./types";
import LocationSelector from "./LocationSelector";
import FileUploadZone from "./FileUploadZone";

export default function InventarioMultiBodegaTab() {
  // -- Locations --
  const locationsQuery = useLocations();
  const allLocations = locationsQuery.data?.locations ?? [];

  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  // Pre-select main warehouses once locations load
  useEffect(() => {
    if (allLocations.length > 0 && selectedLocations.length === 0) {
      const mainSet = new Set<string>(MAIN_WAREHOUSES);
      const preselected = allLocations
        .filter((l) => mainSet.has(l.name))
        .map((l) => l.name);
      setSelectedLocations(preselected);
    }
  }, [allLocations, selectedLocations.length]);

  // -- Sales --
  const salesStatus = useSalesStatus(true);
  const salesLoad = useSalesLoad();
  const salesLoaded = salesStatus.data?.cache.loaded ?? false;
  const [includeSales, setIncludeSales] = useState(false);

  const handleLoadSales = async () => {
    try {
      const result = await salesLoad.mutateAsync();
      toast.success(
        `Ventas cargadas: ${result.skus_count} SKUs`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar ventas");
    }
  };

  // -- Inventory --
  const [file, setFile] = useState<File | null>(null);
  const inventoryMutation = useInventoryExcel();

  const handleProcess = async () => {
    if (!file || selectedLocations.length === 0) return;
    try {
      await inventoryMutation.mutateAsync({
        file,
        locationNames: selectedLocations,
        includeSales,
      });
      toast.success("Archivo de inventario descargado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar inventario");
    }
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Sales card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Datos de Ventas (opcional)
          </CardTitle>
          <CardDescription>
            Carga las ventas de los últimos 12 meses desde Shopify para incluirlas en el reporte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {salesStatus.isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : salesLoaded ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">
                {salesStatus.data!.cache.skus_count} SKUs cargados
              </Badge>
              {salesStatus.data!.cache.loaded_at && (
                <span className="text-xs text-muted-foreground">
                  Cargado: {new Date(salesStatus.data!.cache.loaded_at).toLocaleString("es-CO")}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSales}
                disabled={salesLoad.isPending}
              >
                {salesLoad.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Actualizar Ventas
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleLoadSales}
              disabled={salesLoad.isPending}
            >
              {salesLoad.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando ventas... esto puede tardar varios minutos
                </>
              ) : (
                "Cargar Ventas"
              )}
            </Button>
          )}

          <Label className="flex items-center gap-2 font-normal cursor-pointer">
            <Checkbox
              checked={includeSales}
              onCheckedChange={(v) => setIncludeSales(v === true)}
              disabled={!salesLoaded}
            />
            Incluir ventas 12M en el reporte
          </Label>
        </CardContent>
      </Card>

      {/* Locations card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selección de Bodegas</CardTitle>
        </CardHeader>
        <CardContent>
          {locationsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-40" />
              ))}
            </div>
          ) : locationsQuery.isError ? (
            <p className="text-sm text-destructive">Error al cargar bodegas</p>
          ) : (
            <LocationSelector
              locations={allLocations}
              selected={selectedLocations}
              onChange={setSelectedLocations}
            />
          )}
        </CardContent>
      </Card>

      {/* File upload + process card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consultar Existencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadZone
            title="Subir archivo Excel"
            hint="Arrastra o haz clic — columnas: ISBN y Cantidad"
            isLoaded={file !== null}
            fileName={file?.name}
            onFileSelected={setFile}
          />

          {inventoryMutation.isPending && <Progress className="animate-pulse" />}

          <Button
            onClick={handleProcess}
            disabled={
              !file ||
              selectedLocations.length === 0 ||
              inventoryMutation.isPending
            }
          >
            {inventoryMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Consultar Existencias
          </Button>

          {inventoryMutation.isError && (
            <p className="text-sm text-destructive">
              {inventoryMutation.error instanceof Error
                ? inventoryMutation.error.message
                : "Error al procesar"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
