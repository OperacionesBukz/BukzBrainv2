import { useRef } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadFieldProps {
  label: string;
  description?: string;
  fileName: string | null;
  accept: string;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function FileUploadField({
  label,
  description,
  fileName,
  accept,
  onFileSelected,
  onClear,
  disabled,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = "";
  };

  if (fileName) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-3 rounded-lg border border-muted-foreground/25 p-3">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium flex-1 truncate">{fileName}</span>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors
          border-muted-foreground/25 hover:border-muted-foreground/50
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastra un archivo aquí o haz clic para seleccionar
        </p>
        {description && (
          <p className="text-xs text-muted-foreground/70">{description}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
