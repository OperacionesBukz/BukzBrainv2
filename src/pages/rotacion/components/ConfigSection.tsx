import { useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configuracion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
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
          className="w-full sm:w-auto"
          disabled={!file || disabled}
          onClick={() => file && onStart(file, Number(months))}
        >
          {disabled ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculando...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Calcular Rotacion
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
