import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileUploadZone from "@/pages/ingreso/FileUploadZone";

interface UploadStepProps {
  salesFile: File | null;
  notesFile: File | null;
  isProcessing: boolean;
  dataReady: boolean;
  onSalesFileSelected: (file: File) => void;
  onNotesFileSelected: (file: File) => void;
  onProcess: () => void;
}

export default function UploadStep({
  salesFile,
  notesFile,
  isProcessing,
  dataReady,
  onSalesFileSelected,
  onNotesFileSelected,
  onProcess,
}: UploadStepProps) {
  return (
    <div className="space-y-6">
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

      <div className="flex justify-end">
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
  );
}
