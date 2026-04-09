import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SedesTab from "./devoluciones/SedesTab";
import ProveedoresTab from "./devoluciones/ProveedoresTab";
import HistorialTab from "./devoluciones/HistorialTab";

const Devoluciones = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "sedes";
  const highlightCodigo = searchParams.get("codigo") || undefined;

  const handleTabChange = (value: string) => {
    if (value === "sedes") {
      setSearchParams({});
    } else {
      setSearchParams({ tab: value });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          Devoluciones
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Envío de notificaciones de devolución a sedes y proveedores
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="sedes">Sedes</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="sedes">
          <SedesTab />
        </TabsContent>
        <TabsContent value="proveedores">
          <ProveedoresTab />
        </TabsContent>
        <TabsContent value="historial">
          <HistorialTab highlightCodigo={highlightCodigo} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Devoluciones;
