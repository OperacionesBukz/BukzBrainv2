import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ModuleInfoButton } from "@/components/ModuleInfoButton";
import { MODULE_INFO } from "@/lib/module-info";
import { useDirectory } from "./operations/directorio/useDirectory";
import DirectoryTab from "./operations/directorio/DirectoryTab";

const Directorio = () => {
  const { entries, loading, addEntry, updateEntry, deleteEntry } =
    useDirectory();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            Directorio
          </h1>
          <ModuleInfoButton content={MODULE_INFO["/directorio"]} />
        </div>
        <p className="mt-1 text-base text-muted-foreground">
          Base de datos de empleados, temporales y proveedores
        </p>
      </div>
      <Tabs defaultValue="empleados">
        <TabsList>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="temporales">Temporales</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>
        <TabsContent value="empleados">
          <DirectoryTab
            type="empleado"
            entries={entries}
            loading={loading}
            addEntry={addEntry}
            updateEntry={updateEntry}
            deleteEntry={deleteEntry}
          />
        </TabsContent>
        <TabsContent value="temporales">
          <DirectoryTab
            type="temporal"
            entries={entries}
            loading={loading}
            addEntry={addEntry}
            updateEntry={updateEntry}
            deleteEntry={deleteEntry}
          />
        </TabsContent>
        <TabsContent value="proveedores">
          <DirectoryTab
            type="proveedor"
            entries={entries}
            loading={loading}
            addEntry={addEntry}
            updateEntry={updateEntry}
            deleteEntry={deleteEntry}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Directorio;
