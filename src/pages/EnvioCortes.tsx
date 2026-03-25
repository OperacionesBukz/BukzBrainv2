import CortesVentasTab from "./envio-cortes/CortesVentasTab";
import CortesNoVentasTab from "./envio-cortes/CortesNoVentasTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
      </TabsList>
      <TabsContent value="ventas">
        <CortesVentasTab />
      </TabsContent>
      <TabsContent value="no-ventas">
        <CortesNoVentasTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default EnvioCortes;
