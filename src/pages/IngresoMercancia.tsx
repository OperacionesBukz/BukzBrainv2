import { AlertCircle, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthCheck } from "./ingreso/hooks";
import ConsultaProductosTab from "./ingreso/ConsultaProductosTab";
import InventarioMultiBodegaTab from "./ingreso/InventarioMultiBodegaTab";
import PlantillasTab from "./ingreso/PlantillasTab";

export default function IngresoMercancia() {
  const health = useHealthCheck();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">
          Ingreso Mercancía
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Consulta de productos, inventario multi-bodega y plantillas
        </p>
      </div>

      {health.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : health.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexión</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            No se pudo conectar con el servidor de operaciones.
            <Button
              variant="outline"
              size="sm"
              onClick={() => health.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="consulta">
          <TabsList>
            <TabsTrigger value="consulta">Consulta de Productos</TabsTrigger>
            <TabsTrigger value="inventario">
              Inventario Multi-Bodega
            </TabsTrigger>
            <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
          </TabsList>
          <TabsContent value="consulta">
            <ConsultaProductosTab />
          </TabsContent>
          <TabsContent value="inventario">
            <InventarioMultiBodegaTab />
          </TabsContent>
          <TabsContent value="plantillas">
            <PlantillasTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
