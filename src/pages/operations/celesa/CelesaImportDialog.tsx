import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Loader2, X, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseExcelFile, type ParsedCelesaRow, type ParseError } from "./excel-import";

interface CelesaImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ParsedCelesaRow[]) => Promise<void>;
}

type Step = "upload" | "preview";

export default function CelesaImportDialog({
  open,
  onOpenChange,
  onImport,
}: CelesaImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [validRows, setValidRows] = useState<ParsedCelesaRow[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setValidRows([]);
    setErrors([]);
    setFileName("");
    setImporting(false);
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setErrors([{ row: 0, message: "Formato no soportado. Usa archivos .xlsx o .xls" }]);
      setStep("preview");
      return;
    }

    setFileName(file.name);
    const result = await parseExcelFile(file);
    setValidRows(result.valid);
    setErrors(result.errors);
    setStep("preview");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    setImporting(true);
    await onImport(validRows);
    setImporting(false);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar pedidos desde Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors
              ${isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }
            `}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                Arrastra un archivo Excel aquí
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                o haz clic para seleccionar (.xlsx, .xls)
              </p>
            </div>
            <div className="w-full mt-4 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">
                <Info className="h-3.5 w-3.5" />
                Columnas requeridas en el archivo
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="font-medium">Pedido</span>
                  <span className="text-muted-foreground">— N.° de pedido</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="font-medium">Cliente</span>
                  <span className="text-muted-foreground">— Nombre</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="font-medium">Producto</span>
                  <span className="text-muted-foreground">— Título del libro</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                  <span className="font-medium">ISBN</span>
                  <span className="text-muted-foreground">— Opcional</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                  <span className="font-medium">Fecha</span>
                  <span className="text-muted-foreground">— DD/MM/AAAA</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle mr-1" />Obligatorio
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 align-middle ml-2 mr-1" />Opcional
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{fileName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" />
                Cambiar archivo
              </Button>
            </div>

            {errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.length} error{errors.length !== 1 ? "es" : ""}
                </div>
                <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 list-disc">
                  {errors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      {err.row > 0 ? `Fila ${err.row}: ` : ""}{err.message}
                    </li>
                  ))}
                  {errors.length > 5 && (
                    <li>... y {errors.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            {validRows.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {validRows.length} pedido{validRows.length !== 1 ? "s" : ""} listo{validRows.length !== 1 ? "s" : ""} para importar
                </p>
                <div className="overflow-auto border rounded-md max-h-[40vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Pedido</th>
                        <th className="text-left px-3 py-2 font-medium">Cliente</th>
                        <th className="text-left px-3 py-2 font-medium">Producto</th>
                        <th className="text-left px-3 py-2 font-medium">ISBN</th>
                        <th className="text-left px-3 py-2 font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {validRows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5">{row.numeroPedido}</td>
                          <td className="px-3 py-1.5">{row.cliente}</td>
                          <td className="px-3 py-1.5">{row.producto}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{row.isbn}</td>
                          <td className="px-3 py-1.5">{row.fechaPedido}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {validRows.length === 0 && errors.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay pedidos válidos para importar
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importando...
                  </>
                ) : (
                  `Importar ${validRows.length} pedido${validRows.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
