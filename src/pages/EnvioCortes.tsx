import { lazy, Suspense } from "react";
import CortesVentasTab from "./envio-cortes/CortesVentasTab";
import CortesNoVentasTab from "./envio-cortes/CortesNoVentasTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/PageSkeleton";

const CortePenguin = lazy(() => import("./CortePenguin"));
const CortePlaneta = lazy(() => import("./CortePlaneta"));
const CorteMuseo = lazy(() => import("./CorteMuseo"));

const EnvioCortes = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
        Envío de Cortes
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        Envío de reportes de cortes de venta a proveedores por email
      </p>
    </div>
    <Tabs defaultValue="ventas">
      <TabsList>
        <TabsTrigger value="ventas">Cortes Ventas</TabsTrigger>
        <TabsTrigger value="no-ventas">Cortes No Ventas</TabsTrigger>
        <TabsTrigger value="penguin">Corte Penguin</TabsTrigger>
        <TabsTrigger value="planeta">Corte Planeta</TabsTrigger>
        <TabsTrigger value="museo">Corte Museo</TabsTrigger>
      </TabsList>
      <TabsContent value="ventas">
        <CortesVentasTab />
      </TabsContent>
      <TabsContent value="no-ventas">
        <CortesNoVentasTab />
      </TabsContent>
      <TabsContent value="penguin">
        <Suspense fallback={<PageSkeleton />}>
          <CortePenguin />
        </Suspense>
      </TabsContent>
      <TabsContent value="planeta">
        <Suspense fallback={<PageSkeleton />}>
          <CortePlaneta />
        </Suspense>
      </TabsContent>
      <TabsContent value="museo">
        <Suspense fallback={<PageSkeleton />}>
          <CorteMuseo />
        </Suspense>
      </TabsContent>
    </Tabs>
  </div>
);

export default EnvioCortes;
