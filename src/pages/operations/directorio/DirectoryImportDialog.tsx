import { useState, useRef, useCallback, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  parsePersonExcel,
  parseSupplierExcel,
  type ParsedPersonRow,
  type ParsedSupplierRow,
  type ParseError,
} from "./excel-utils";
import type { DirectoryType, DirectoryEntry } from "./types";

interface DirectoryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DirectoryType;
  existingEntries?: DirectoryEntry[];
  onImportPersons: (rows: ParsedPersonRow[]) => Promise<void>;
  onImportSuppliers: (rows: ParsedSupplierRow[]) => Promise<void>;
}

type Step = "upload" | "preview";

export default function DirectoryImportDialog({
  open,
  onOpenChange,
  type,
  existingEntries = [],
  onImportPersons,
  onImportSuppliers,
}: DirectoryImportDialogProps) {
  const isPersonType = type === "empleado" || type === "temporal";
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [personRows, setPersonRows] = useState<ParsedPersonRow[]>([]);
  const [supplierRows, setSupplierRows] = useState<ParsedSupplierRow[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validCount = isPersonType ? personRows.length : supplierRows.length;

  // For suppliers, compute how many will be updated vs created
  const mergeStats = useMemo(() => {
    if (isPersonType || supplierRows.length === 0) return null;
    const existingNames = new Set(
      existingEntries
        .filter((e) => e.type === "proveedor" && "empresa" in e)
        .map((e) => (e as { empresa: string }).empresa.trim().toLowerCase())
    );
    let toUpdate = 0;
    let toCreate = 0;
    for (const row of supplierRows) {
      if (existingNames.has(row.empresa.trim().toLowerCase())) {
        toUpdate++;
      } else {
        toCreate++;
      }
    }
    return { toUpdate, toCreate };
  }, [isPersonType, supplierRows, existingEntries]);

  const reset = useCallback(() => {
    setStep("upload");
    setPersonRows([]);
    setSupplierRows([]);
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
      setErrors([
        {
          row: 0,
          message: "Formato no soportado. Usa archivos .xlsx o .xls",
        },
      ]);
      setStep("preview");
      return;
    }

    setFileName(file.name);

    if (isPersonType) {
      const result = await parsePersonExcel(file);
      setPersonRows(result.valid);
      setErrors(result.errors);
    } else {
      const result = await parseSupplierExcel(file);
      setSupplierRows(result.valid);
      setErrors(result.errors);
    }
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
    if (isPersonType) {
      await onImportPersons(personRows);
    } else {
      await onImportSuppliers(supplierRows);
    }
    setImporting(false);
    handleOpenChange(false);
  };

  const columnsHint = isPersonType
    ? "Nombre, Apellido, Cédula, Celular, Correo"
    : "Empresa, Razón Social, NIT, Margen, Correo, Correos CC, Observaciones";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar desde Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors
              ${
                isDragging
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
            <p className="text-xs text-muted-foreground mt-2">
              Columnas esperadas: {columnsHint}
            </p>
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
                      {err.row > 0 ? `Fila ${err.row}: ` : ""}
                      {err.message}
                    </li>
                  ))}
                  {errors.length > 5 && (
                    <li>... y {errors.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            {validCount > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {validCount} registro{validCount !== 1 ? "s" : ""} listo
                  {validCount !== 1 ? "s" : ""} para importar
                  {mergeStats && (mergeStats.toUpdate > 0 || mergeStats.toCreate > 0) && (
                    <span className="ml-1">
                      ({mergeStats.toUpdate > 0 && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {mergeStats.toUpdate} a actualizar
                        </span>
                      )}
                      {mergeStats.toUpdate > 0 && mergeStats.toCreate > 0 && ", "}
                      {mergeStats.toCreate > 0 && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {mergeStats.toCreate} nuevo{mergeStats.toCreate !== 1 ? "s" : ""}
                        </span>
                      )})
                    </span>
                  )}
                </p>
                <div className="overflow-auto border rounded-md max-h-[40vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {isPersonType ? (
                          <>
                            <th className="text-left px-3 py-2 font-medium">
                              Nombre
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Apellido
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Cédula
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Celular
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Correo
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="text-left px-3 py-2 font-medium">
                              Empresa
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Razón Social
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              NIT
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Margen %
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Correo
                            </th>
                            <th className="text-left px-3 py-2 font-medium">
                              Correos CC
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {isPersonType
                        ? personRows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                              <td className="px-3 py-1.5">{row.nombre}</td>
                              <td className="px-3 py-1.5">{row.apellido}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {row.cedula}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {row.celular}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {row.correo}
                              </td>
                            </tr>
                          ))
                        : supplierRows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                              <td className="px-3 py-1.5">{row.empresa}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {row.razonSocial}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {row.nit}
                              </td>
                              <td className="px-3 py-1.5">{row.margen}%</td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {row.correo}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {row.correos_cc.join("; ")}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {validCount === 0 && errors.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay registros válidos para importar
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importando...
                  </>
                ) : (
                  `Importar ${validCount} registro${validCount !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
