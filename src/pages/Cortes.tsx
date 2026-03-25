import CortesTab from "./operations/cortes/CortesTab";
import DescuentoTab from "./operations/cortes/DescuentoTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Cortes = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Cortes</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Procesamiento de promociones y descuentos
      </p>
    </div>
    <Tabs defaultValue="3x2">
      <TabsList>
        <TabsTrigger value="3x2">3X2</TabsTrigger>
        <TabsTrigger value="descuento">% Descuento</TabsTrigger>
      </TabsList>
      <TabsContent value="3x2">
        <CortesTab />
      </TabsContent>
      <TabsContent value="descuento">
        <DescuentoTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default Cortes;
