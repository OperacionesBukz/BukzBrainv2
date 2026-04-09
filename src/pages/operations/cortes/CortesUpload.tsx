import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CortesUploadProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function CortesUpload({ onFileSelected, disabled }: CortesUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") return;
    setFileName(file.name);
    onFileSelected(file);
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

  const reset = () => {
    setFileName("");
  };

  if (fileName) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-muted-foreground/25 p-4">
        <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium flex-1 truncate">{fileName}</span>
        <Button variant="ghost" size="sm" onClick={reset} disabled={disabled}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 md:p-10 cursor-pointer transition-colors
        ${isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <Upload className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">
          Arrastra un archivo de corte aquí
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          o haz clic para seleccionar (.xlsx, .xls)
        </p>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Se procesarán las filas con descuento "3X2"
      </p>
      <div className="mt-2 text-xs text-muted-foreground/70 text-center space-y-0.5 hidden md:block">
        <p className="font-medium text-muted-foreground">Columnas requeridas:</p>
        <p>Order name · Discount name · Product variant SKU</p>
        <p className="italic">Opcionales: Product title · Product vendor · Net items sold</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
