import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SedesTab from "./pedidos/SedesTab";
import CiudadTab from "./pedidos/CiudadTab";
import HistorialTab from "./pedidos/HistorialTab";

const Pedidos = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
        Pedidos
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        Envío de pedidos a proveedores por sede o ciudad
      </p>
    </div>
    <Tabs defaultValue="sedes">
      <TabsList>
        <TabsTrigger value="sedes">Por Sedes</TabsTrigger>
        <TabsTrigger value="ciudad">Por Ciudad</TabsTrigger>
        <TabsTrigger value="historial">Historial</TabsTrigger>
      </TabsList>
      <TabsContent value="sedes">
        <SedesTab />
      </TabsContent>
      <TabsContent value="ciudad">
        <CiudadTab />
      </TabsContent>
      <TabsContent value="historial">
        <HistorialTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default Pedidos;
