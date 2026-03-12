import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FileUploadCardProps {
  title: string;
  hint: string;
  accept?: string;
  fileName?: string;
  isLoaded: boolean;
  error?: string;
  onFileLoaded: (text: string, fileName: string) => void;
}

export default function FileUploadCard({
  title,
  hint,
  accept = ".csv",
  fileName,
  isLoaded,
  error,
  onFileLoaded,
}: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      onFileLoaded(text, file.name);
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:opacity-90",
        error
          ? "border-destructive bg-destructive/5"
          : isLoaded
            ? "border-primary bg-primary/5"
            : isDragging
              ? "border-primary bg-primary/5 scale-[1.02] shadow-lg"
              : "border-dashed border-2 border-muted-foreground/25"
      )}
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
      <CardHeader className="pb-2 pt-6 text-center">
        <div className="flex justify-center mb-2">
          {error ? (
            <AlertCircle className="h-10 w-10 text-destructive" />
          ) : isLoaded ? (
            <CheckCircle2 className="h-10 w-10 text-primary" />
          ) : isDragging ? (
            <FileSpreadsheet className="h-10 w-10 text-primary animate-pulse" />
          ) : (
            <Upload className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
      </CardHeader>
      <CardContent className="text-center pb-6">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : isLoaded && fileName ? (
          <p className="text-sm text-primary font-medium">{fileName}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
