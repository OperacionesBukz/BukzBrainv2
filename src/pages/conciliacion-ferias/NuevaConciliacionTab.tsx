import { useState } from "react";
import { Loader2, Search, ChevronsUpDown, Check, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLocations, useConciliar } from "./hooks";
import { logConciliacion } from "./api";
import type {
  ConciliacionResponse,
  ConciliacionRequest,
} from "./types";

interface NuevaConciliacionTabProps {
  onResultados: (
    data: ConciliacionResponse,
    request: ConciliacionRequest,
  ) => void;
}

export function NuevaConciliacionTab({
  onResultados,
}: NuevaConciliacionTabProps) {
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    id: string;
  } | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const { user } = useAuth();
  const { data: locationsData, isLoading: locationsLoading } =
    useLocations();
  const mutation = useConciliar();

  const locations = locationsData?.locations ?? [];
  const canSubmit =
    selectedLocation && fechaInicio && fechaFin && !mutation.isPending;

  const handleSubmit = () => {
    if (!selectedLocation || !fechaInicio || !fechaFin) return;

    const request: ConciliacionRequest = {
      location_name: selectedLocation.name,
      location_id: selectedLocation.id,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    };

    mutation.mutate(request, {
      onSuccess: (data) => {
        toast.success(
          `Conciliacion completada: ${data.resumen.total_skus} SKUs procesados`,
        );
        onResultados(data, request);

        // Log a Firestore
        logConciliacion({
          feriaLocation: selectedLocation.name,
          feriaLocationId: selectedLocation.id,
          fechaInicio,
          fechaFin,
          totalEnviado: data.resumen.total_enviado,
          totalDevuelto: data.resumen.total_devuelto,
          totalVendido: data.resumen.total_vendido,
          totalDiferencia: data.resumen.total_diferencia,
          skusConDiferencia:
            data.resumen.skus_faltante + data.resumen.skus_sobrante,
          totalSkus: data.resumen.total_skus,
          realizadoPor: user?.email ?? "",
          realizadoPorNombre:
            user?.displayName ?? user?.email ?? "",
        }).catch((err) =>
          console.error("[conciliacion-ferias] Error al guardar log:", err),
        );
      },
      onError: (err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Error al ejecutar conciliacion",
        );
      },
    });
  };

  if (mutation.isPending) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Consultando datos de Shopify... esto puede tardar hasta 2
              minutos
            </p>
            <p className="text-xs text-muted-foreground/70 text-center">
              Buscando transfers enviados, devueltos y ventas en la
              feria
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Nueva Conciliacion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Location selector */}
        <div className="space-y-1.5">
          <Label>Ubicacion de la feria</Label>
          <Popover open={locationOpen} onOpenChange={setLocationOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={locationOpen}
                className="w-full justify-between font-normal"
                disabled={locationsLoading}
              >
                {locationsLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />{" "}
                    Cargando ubicaciones...
                  </span>
                ) : selectedLocation ? (
                  selectedLocation.name
                ) : (
                  <span className="text-muted-foreground">
                    Seleccionar ubicacion...
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar ubicacion..." />
                <CommandList>
                  <CommandEmpty>No se encontraron ubicaciones.</CommandEmpty>
                  <CommandGroup>
                    {locations.map((loc) => (
                      <CommandItem
                        key={loc.id}
                        value={loc.name}
                        onSelect={() => {
                          setSelectedLocation(loc);
                          setLocationOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedLocation?.id === loc.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {loc.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Date pickers */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fecha-inicio">Fecha inicio</Label>
            <Input
              id="fecha-inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha-fin">Fecha fin</Label>
            <Input
              id="fecha-fin"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          <Search className="h-4 w-4 mr-2" />
          Conciliar
        </Button>
      </CardContent>
    </Card>
  );
}
