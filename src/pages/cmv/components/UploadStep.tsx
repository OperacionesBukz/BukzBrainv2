import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import FileUploadZone from "@/pages/ingreso/FileUploadZone";

interface UploadStepProps {
  salesFile: File | null;
  notesFile: File | null;
  isProcessing: boolean;
  dataReady: boolean;
  onSalesFileSelected: (file: File) => void;
  onNotesFileSelected: (file: File) => void;
  onProcess: () => void;
  onImportCompleted: (file: File) => void;
}

export default function UploadStep({
  salesFile,
  notesFile,
  isProcessing,
  dataReady,
  onSalesFileSelected,
  onNotesFileSelected,
  onProcess,
  onImportCompleted,
}: UploadStepProps) {
  return (
    <div className="space-y-6">
      {/* Opción 1: Procesar datos crudos */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Procesar datos crudos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUploadZone
            title="Movimiento de ventas y compras"
            hint="Arrastra o haz clic para cargar el archivo Excel (.xlsx)"
            accept=".xlsx,.xls"
            fileName={salesFile?.name}
            isLoaded={!!salesFile}
            onFileSelected={onSalesFileSelected}
          />
          <FileUploadZone
            title="Notas crédito/débito"
            hint="Opcional — Arrastra o haz clic para cargar el archivo Excel (.xlsx)"
            accept=".xlsx,.xls"
            fileName={notesFile?.name}
            isLoaded={!!notesFile}
            onFileSelected={onNotesFileSelected}
          />
        </div>

        <div className="flex justify-end mt-4">
          <Button
            size="lg"
            disabled={!salesFile || isProcessing || !dataReady}
            onClick={onProcess}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!dataReady ? "Cargando datos…" : isProcessing ? "Procesando…" : "Procesar"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground uppercase">o</span>
        <Separator className="flex-1" />
      </div>

      {/* Opción 2: Subir CMV ya completado */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Importar CMV completado (con Descuento y Margen)
        </h3>
        <FileUploadZone
          title="CMV completado"
          hint="Sube el Excel del CMV con las columnas Descuento y Margen ya llenadas"
          accept=".xlsx,.xls"
          isLoaded={false}
          onFileSelected={onImportCompleted}
        />
      </div>
    </div>
  );
}
