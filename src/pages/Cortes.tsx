import CortesTab from "./operations/cortes/CortesTab";
import DescuentoTab from "./operations/cortes/DescuentoTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ModuleInfoButton } from "@/components/ModuleInfoButton";
import { MODULE_INFO } from "@/lib/module-info";

const Cortes = () => (
  <div className="space-y-6">
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Cortes</h1>
        <ModuleInfoButton content={MODULE_INFO["/cortes"]} />
      </div>
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
