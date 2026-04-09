import { useState, useRef, useCallback } from "react";
import {
  Loader2,
  Search,
  ChevronsUpDown,
  Check,
  BarChart3,
  Upload,
  FileSpreadsheet,
  X,
} from "lucide-react";
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
  ConciliacionParams,
} from "./types";

interface NuevaConciliacionTabProps {
  onResultados: (
    data: ConciliacionResponse,
    params: ConciliacionParams,
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
  const [fileEnviado, setFileEnviado] = useState<File | null>(null);
  const [fileDevuelto, setFileDevuelto] = useState<File | null>(null);
  const [dragOverEnviado, setDragOverEnviado] = useState(false);
  const [dragOverDevuelto, setDragOverDevuelto] = useState(false);

  const inputEnviadoRef = useRef<HTMLInputElement>(null);
  const inputDevueltoRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { data: locationsData, isLoading: locationsLoading } =
    useLocations();
  const mutation = useConciliar();

  const locations = locationsData?.locations ?? [];
  const canSubmit =
    selectedLocation &&
    fechaInicio &&
    fechaFin &&
    fileEnviado &&
    fileDevuelto &&
    !mutation.isPending;

  const handleFileDrop = useCallback(
    (e: React.DragEvent, setter: (f: File | null) => void) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (
        file &&
        (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))
      ) {
        setter(file);
      } else {
        toast.error("Solo se aceptan archivos Excel (.xlsx, .xls)");
      }
    },
    [],
  );

  const handleFileInput = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      setter: (f: File | null) => void,
    ) => {
      const file = e.target.files?.[0] ?? null;
      setter(file);
      // Reset input para poder seleccionar el mismo archivo de nuevo
      e.target.value = "";
    },
    [],
  );

  const handleSubmit = () => {
    if (!selectedLocation || !fechaInicio || !fechaFin || !fileEnviado || !fileDevuelto) return;

    const params: ConciliacionParams = {
      location_name: selectedLocation.name,
      location_id: selectedLocation.id,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      file_enviado: fileEnviado,
      file_devuelto: fileDevuelto,
    };

    mutation.mutate(params, {
      onSuccess: (data) => {
        toast.success(
          `Conciliacion completada: ${data.resumen.total_skus} SKUs procesados`,
        );
        onResultados(data, params);

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
              Procesando archivos y consultando ventas en Shopify... esto
              puede tardar hasta 2 minutos
            </p>
            <p className="text-xs text-muted-foreground/70 text-center">
              Leyendo inventario enviado, devuelto y cruzando con ventas
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

        {/* File upload zones */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Archivo enviado */}
          <div className="space-y-1.5">
            <Label>Excel inventario enviado</Label>
            <input
              ref={inputEnviadoRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileInput(e, setFileEnviado)}
            />
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
                dragOverEnviado
                  ? "border-primary bg-primary/5"
                  : fileEnviado
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={() => inputEnviadoRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputEnviadoRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverEnviado(true);
              }}
              onDragLeave={() => setDragOverEnviado(false)}
              onDrop={(e) => {
                setDragOverEnviado(false);
                handleFileDrop(e, setFileEnviado);
              }}
            >
              {fileEnviado ? (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium text-foreground text-center truncate max-w-full">
                    {fileEnviado.name}
                  </p>
                  <button
                    type="button"
                    className="absolute top-2 right-2 rounded-full p-1 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileEnviado(null);
                    }}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    Arrastra o haz clic para subir el Excel de inventario
                    enviado
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Archivo devuelto */}
          <div className="space-y-1.5">
            <Label>Excel inventario devuelto</Label>
            <input
              ref={inputDevueltoRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileInput(e, setFileDevuelto)}
            />
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
                dragOverDevuelto
                  ? "border-primary bg-primary/5"
                  : fileDevuelto
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={() => inputDevueltoRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputDevueltoRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDevuelto(true);
              }}
              onDragLeave={() => setDragOverDevuelto(false)}
              onDrop={(e) => {
                setDragOverDevuelto(false);
                handleFileDrop(e, setFileDevuelto);
              }}
            >
              {fileDevuelto ? (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium text-foreground text-center truncate max-w-full">
                    {fileDevuelto.name}
                  </p>
                  <button
                    type="button"
                    className="absolute top-2 right-2 rounded-full p-1 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileDevuelto(null);
                    }}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    Arrastra o haz clic para subir el Excel de inventario
                    devuelto
                  </p>
                </>
              )}
            </div>
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
