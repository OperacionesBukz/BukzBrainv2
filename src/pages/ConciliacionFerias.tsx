import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ModuleInfoButton } from "@/components/ModuleInfoButton";
import { MODULE_INFO } from "@/lib/module-info";
import { NuevaConciliacionTab } from "./conciliacion-ferias/NuevaConciliacionTab";
import { ResultadosTab } from "./conciliacion-ferias/ResultadosTab";
import { HistorialTab } from "./conciliacion-ferias/HistorialTab";
import type {
  ConciliacionResponse,
  ConciliacionParams,
} from "./conciliacion-ferias/types";

export default function ConciliacionFerias() {
  const [activeTab, setActiveTab] = useState("nueva");
  const [resultados, setResultados] =
    useState<ConciliacionResponse | null>(null);
  const [lastParams, setLastParams] =
    useState<ConciliacionParams | null>(null);

  const handleResultados = (
    data: ConciliacionResponse,
    params: ConciliacionParams,
  ) => {
    setResultados(data);
    setLastParams(params);
    setActiveTab("resultados");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            Conciliacion de Ferias
          </h1>
          <ModuleInfoButton content={MODULE_INFO["/conciliacion-ferias"]} />
        </div>
        <p className="mt-1 text-base text-muted-foreground">
          Cruza inventario enviado, devuelto y vendido para detectar
          faltantes
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="nueva">Nueva Conciliacion</TabsTrigger>
          <TabsTrigger value="resultados">
            Resultados
            {resultados
              ? ` (${resultados.resumen.total_skus})`
              : ""}
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="nueva">
          <NuevaConciliacionTab onResultados={handleResultados} />
        </TabsContent>
        <TabsContent value="resultados">
          <ResultadosTab data={resultados} params={lastParams} />
        </TabsContent>
        <TabsContent value="historial">
          <HistorialTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
