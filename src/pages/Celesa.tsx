import CelesaTab from "./operations/celesa/CelesaTab";
import { ModuleInfoButton } from "@/components/ModuleInfoButton";
import { MODULE_INFO } from "@/lib/module-info";

const Celesa = () => (
  <div className="space-y-6">
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Celesa</h1>
        <ModuleInfoButton content={MODULE_INFO["/celesa"]} />
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        Seguimiento de pedidos de importación
      </p>
    </div>
    <CelesaTab />
  </div>
);

export default Celesa;
