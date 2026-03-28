import { useEffect, useState } from "react";
import { Loader2, RefreshCw, BarChart3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocations, useSalesLoad, useSalesStatus, useInventoryExcel } from "./hooks";
import { downloadBlob } from "./api";
import { MAIN_WAREHOUSES, FALLBACK_WAREHOUSES, type LocationItem } from "./types";
import LocationSelector from "./LocationSelector";
import FileUploadZone from "./FileUploadZone";
import InventoryPreview from "./InventoryPreview";

export default function InventarioMultiBodegaTab() {
  // -- Locations --
  const locationsQuery = useLocations();
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Build location list: API data or fallback
  const usingFallback = locationsQuery.isError || (!locationsQuery.isLoading && (locationsQuery.data?.locations ?? []).length === 0);
  const allLocations: LocationItem[] = usingFallback
    ? FALLBACK_WAREHOUSES.map((name, i) => ({ name, id: i }))
    : (locationsQuery.data?.locations ?? []);

  // Pre-select main warehouses once
  useEffect(() => {
    if (!initialized && allLocations.length > 0) {
      const mainSet = new Set<string>(MAIN_WAREHOUSES);
      const preselected = allLocations
        .filter((l) => mainSet.has(l.name))
        .map((l) => l.name);
      setSelectedLocations(preselected);
      setInitialized(true);
    }
  }, [allLocations, initialized]);

  // -- Sales --
  const salesStatus = useSalesStatus(true);
  const salesLoad = useSalesLoad();
  const salesLoaded = salesStatus.data?.cache.loaded ?? false;
  const salesJobRunning = salesStatus.data?.job?.running ?? false;
  const salesJobError = salesStatus.data?.job?.error ?? null;
  const [includeSales, setIncludeSales] = useState(false);

  const handleLoadSales = async () => {
    try {
      await salesLoad.mutateAsync();
      toast.success("Carga de ventas iniciada en background");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar ventas");
    }
  };

  // -- Inventory --
  const [file, setFile] = useState<File | null>(null);
  const [inventoryBlob, setInventoryBlob] = useState<Blob | null>(null);
  const inventoryMutation = useInventoryExcel();

  const handleProcess = async () => {
    if (!file || selectedLocations.length === 0) return;
    setInventoryBlob(null);
    try {
      const blob = await inventoryMutation.mutateAsync({
        file,
        locationNames: selectedLocations,
        includeSales,
      });
      setInventoryBlob(blob);
      toast.success("Resultados listos para descargar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar inventario");
    }
  };

  const handleDownload = () => {
    if (!inventoryBlob) return;
    downloadBlob(inventoryBlob, "Inventario_Bodegas.xlsx");
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
          ) : salesJobRunning ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Cargando ventas en background... esto puede tardar varios minutos
              </span>
            </div>
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
            <div className="space-y-2">
              <Button
                onClick={handleLoadSales}
                disabled={salesLoad.isPending}
              >
                {salesLoad.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Cargar Ventas
              </Button>
              {salesJobError && (
                <p className="text-sm text-destructive">{salesJobError}</p>
              )}
            </div>
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
        <CardContent className="space-y-3">
          {usingFallback && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No se pudieron cargar las bodegas del servidor. Usando lista predeterminada.
              </AlertDescription>
            </Alert>
          )}
          {locationsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-40" />
              ))}
            </div>
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
            onFileSelected={(f) => {
              setFile(f);
              setInventoryBlob(null);
            }}
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

          {inventoryBlob && (
            <InventoryPreview blob={inventoryBlob} onDownload={handleDownload} />
          )}

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
