import { useState } from "react";
import { TrendingUp, Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FileUploadZone from "@/pages/ingreso/FileUploadZone";

interface ConfigSectionProps {
  onStart: (file: File, months: number) => void;
  disabled: boolean;
}

export default function ConfigSection({ onStart, disabled }: ConfigSectionProps) {
  const [months, setMonths] = useState("12");
  const [file, setFile] = useState<File | null>(null);

  const isReady = !!file && !disabled;

  return (
    <div className="relative max-w-[640px] mx-auto overflow-hidden rounded-2xl border border-border/50 bg-card">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-dot-pattern opacity-30 dark:opacity-15" />

      <div className="relative pt-8 pb-8 px-6 sm:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Concentric ring icon */}
          <div className="relative w-[80px] h-[80px] flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-subtle-pulse" />
            <div className="w-[56px] h-[56px] rounded-full bg-primary/15 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold mt-4">Configurar Analisis</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-[400px]">
            Sube el inventario por sede y selecciona el periodo de ventas para calcular la rotacion
          </p>
        </div>

        <div className="grid gap-4 mt-6">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Periodo de ventas
            </label>
              <Select value={months} onValueChange={setMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Inventario por sede (Excel)
            </label>
              <FileUploadZone
                title="Subir inventario"
                hint="Excel con columnas: Sede, Inventario"
                fileName={file?.name}
                isLoaded={!!file}
                onFileSelected={setFile}
              />
          </div>
        </div>

        {/* CTA button with shimmer */}
        <Button
          className={
            "group relative w-full h-[48px] text-base font-semibold mt-6 press-effect overflow-hidden transition-shadow duration-300 " +
            (isReady ? "shadow-[0_0_20px_hsl(var(--primary)/0.3)]" : "")
          }
          disabled={!file || disabled}
          onClick={() => file && onStart(file, Number(months))}
        >
          {/* Shimmer overlay */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <span className="relative flex items-center justify-center">
            {disabled ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-5 w-5" />
                Calcular Rotacion
              </>
            )}
          </span>
        </Button>
      </div>
    </div>
  );
}
