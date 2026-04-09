import { useState } from "react";
import { TrendingUp, Calculator, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <Card className="max-w-[640px] mx-auto">
      <CardContent className="pt-8 pb-8 px-6 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-[64px] h-[64px] rounded-2xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mt-4">Configurar Analisis</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-[400px]">
            Sube el inventario por sede y selecciona el periodo de ventas para calcular la rotacion
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Periodo de ventas</label>
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
            <label className="text-sm font-medium">Inventario por sede (Excel)</label>
            <FileUploadZone
              title="Subir inventario"
              hint="Excel con columnas: Sede, Inventario"
              fileName={file?.name}
              isLoaded={!!file}
              onFileSelected={setFile}
            />
          </div>
        </div>

        <Button
          className="w-full h-[48px] text-base font-semibold mt-6 press-effect"
          disabled={!file || disabled}
          onClick={() => file && onStart(file, Number(months))}
        >
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
        </Button>
      </CardContent>
    </Card>
  );
}
