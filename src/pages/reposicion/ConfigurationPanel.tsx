import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Loader2, Rocket } from "lucide-react";
import type { SedeInfo } from "./types";

interface ConfigurationPanelProps {
  sedes: SedeInfo[];
  selectedSede: string;
  leadTime: number;
  isProcessing: boolean;
  onSedeChange: (sede: string) => void;
  onLeadTimeChange: (days: number) => void;
  onGenerate: () => void;
}

export default function ConfigurationPanel({
  sedes,
  selectedSede,
  leadTime,
  isProcessing,
  onSedeChange,
  onLeadTimeChange,
  onGenerate,
}: ConfigurationPanelProps) {
  const canGenerate = selectedSede && !isProcessing;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          Configuración
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Sede para analizar</Label>
            <Select value={selectedSede} onValueChange={onSedeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar sede..." />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((s) => (
                  <SelectItem key={s.label} value={s.label}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tiempo de entrega del proveedor (días)</Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={leadTime}
              onChange={(e) => onLeadTimeChange(parseInt(e.target.value) || 14)}
            />
          </div>
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              Generar Modelo de Reposición
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
