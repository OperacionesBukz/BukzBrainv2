import { Calculator, Loader2 } from "lucide-react";
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
import VendorMultiSelect from "./VendorMultiSelect";
import type { LocationItem, VendorItem } from "../types";

interface ConfigPanelProps {
  locations: LocationItem[];
  vendors: VendorItem[];
  config: {
    location_id: string;
    vendors: string[];
    lead_time_days: number;
    safety_factor: number;
    date_range_months: number; // UI uses months, converted to days on submit
  };
  onConfigChange: (config: ConfigPanelProps["config"]) => void;
  onCalcular: () => void;
  isLoading: boolean;
  isLocationsLoading: boolean;
  isVendorsLoading: boolean;
}

export default function ConfigPanel({
  locations,
  vendors,
  config,
  onConfigChange,
  onCalcular,
  isLoading,
  isLocationsLoading,
  isVendorsLoading,
}: ConfigPanelProps) {
  const canCalcular = !isLoading && !!config.location_id;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Configuracion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Sede */}
          <div className="space-y-2">
            <Label htmlFor="location-select">Sede</Label>
            {isLocationsLoading ? (
              <div className="h-10 rounded-md bg-muted animate-pulse" />
            ) : (
              <Select
                value={config.location_id}
                onValueChange={(val) =>
                  onConfigChange({ ...config, location_id: val })
                }
              >
                <SelectTrigger id="location-select" className="w-full">
                  <SelectValue placeholder="Seleccionar sede..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 2. Proveedores */}
          <div className="space-y-2">
            <Label>Proveedores</Label>
            {isVendorsLoading ? (
              <div className="h-10 rounded-md bg-muted animate-pulse" />
            ) : (
              <VendorMultiSelect
                vendors={vendors}
                value={config.vendors}
                onChange={(selected) =>
                  onConfigChange({ ...config, vendors: selected })
                }
                disabled={isLoading}
              />
            )}
          </div>

          {/* 3. Lead Time */}
          <div className="space-y-2">
            <Label htmlFor="lead-time-input">Lead Time (dias)</Label>
            <Input
              id="lead-time-input"
              type="number"
              min={1}
              max={90}
              value={config.lead_time_days}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  lead_time_days: Math.min(
                    90,
                    Math.max(1, parseInt(e.target.value) || 14)
                  ),
                })
              }
              disabled={isLoading}
            />
          </div>

          {/* 4. Rango de Ventas */}
          <div className="space-y-2">
            <Label htmlFor="date-range-input">Rango de analisis (meses)</Label>
            <Input
              id="date-range-input"
              type="number"
              min={1}
              max={12}
              value={config.date_range_months}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  date_range_months: Math.min(
                    12,
                    Math.max(1, parseInt(e.target.value) || 6)
                  ),
                })
              }
              disabled={isLoading}
            />
          </div>

          {/* 5. Safety Factor */}
          <div className="space-y-2">
            <Label htmlFor="safety-factor-input">Factor de seguridad</Label>
            <Input
              id="safety-factor-input"
              type="number"
              min={1.0}
              max={3.0}
              step={0.1}
              value={config.safety_factor}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  safety_factor: Math.min(
                    3.0,
                    Math.max(1.0, parseFloat(e.target.value) || 1.5)
                  ),
                })
              }
              disabled={isLoading}
            />
          </div>

          {/* 6. Calcular button — spans full width on mobile, auto on larger */}
          <div className="space-y-2 flex flex-col justify-end">
            <Label className="invisible" aria-hidden>
              Accion
            </Label>
            <Button
              className="w-full md:w-auto"
              onClick={onCalcular}
              disabled={!canCalcular}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calcular Reposicion
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
