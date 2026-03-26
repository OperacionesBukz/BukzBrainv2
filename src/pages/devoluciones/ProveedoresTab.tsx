import { useState, useCallback } from "react";
import { Loader2, RotateCcw, CheckCircle2, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import FileUploadField from "./FileUploadField";
import { useDevolucionesConfig, useEnviarProveedores } from "./hooks";
import { useAuth } from "@/contexts/AuthContext";
import { logDevolucion } from "./api";
import type { EnvioResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function ProveedoresTab() {
  const [step, setStep] = useState<Step>("config");
  const [proveedor, setProveedor] = useState("");
  const [proveedorOpen, setProveedorOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [numCajas, setNumCajas] = useState(1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [response, setResponse] = useState<EnvioResponse | null>(null);

  const { user } = useAuth();
  const { data: config, isLoading: configLoading } = useDevolucionesConfig();
  const mutation = useEnviarProveedores();

  const canSubmit =
    proveedor && motivo && ciudad && numCajas > 0 && archivo && remitente;

  const handleSubmit = useCallback(() => {
    if (!proveedor || !motivo || !ciudad || !archivo || !remitente) return;

    setStep("processing");
    mutation.mutate(
      { proveedor, motivo, ciudad, numCajas, archivo, remitente },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(`Email enviado a ${data.destinatario}`);
          setStep("results");
          logDevolucion({
            tipo: "proveedor",
            destinatario: data.destinatario,
            correos: data.correos,
            motivo,
            ciudad,
            numCajas,
            nombreArchivo: archivo.name,
            asunto: data.asunto,
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "enviado",
          });
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar email",
          );
          setStep("config");
          logDevolucion({
            tipo: "proveedor",
            destinatario: proveedor,
            correos: [],
            motivo,
            ciudad,
            numCajas,
            nombreArchivo: archivo.name,
            asunto: "",
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "error",
            detalle: err instanceof Error ? err.message : "Error desconocido",
          });
        },
      },
    );
  }, [proveedor, motivo, ciudad, numCajas, archivo, remitente, mutation, user]);

  const handleReset = useCallback(() => {
    setStep("config");
    setProveedor("");
    setMotivo("");
    setCiudad("");
    setNumCajas(1);
    setArchivo(null);
    setResponse(null);
  }, []);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={proveedorOpen}
                    className="w-full justify-between font-normal"
                  >
                    {proveedor || "Buscar proveedor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar proveedor..." />
                    <CommandList>
                      <CommandEmpty>No se encontró proveedor.</CommandEmpty>
                      <CommandGroup>
                        {config?.proveedores.map((p) => (
                          <CommandItem
                            key={p}
                            value={p}
                            onSelect={() => {
                              setProveedor(p === proveedor ? "" : p);
                              setProveedorOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                proveedor === p ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {p}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {config?.motivos_proveedores.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Select value={ciudad} onValueChange={setCiudad}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ciudad" />
                </SelectTrigger>
                <SelectContent>
                  {config?.ciudades.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="num-cajas">Cajas / Paquetes</Label>
              <Input
                id="num-cajas"
                type="number"
                min={1}
                value={numCajas}
                onChange={(e) => setNumCajas(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remitente-prov">Remitente</Label>
              <Input
                id="remitente-prov"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
              />
            </div>
          </div>

          <FileUploadField
            label="Archivo de la devolución"
            description="Formatos aceptados: xlsx, xls, csv, png, jpg, pdf"
            accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg,.pdf"
            fileName={archivo?.name ?? null}
            onFileSelected={setArchivo}
            onClear={() => setArchivo(null)}
          />

          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Enviar correo a proveedor
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando email al proveedor...
          </p>
        </div>
      )}

      {step === "results" && response && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Email enviado correctamente</span>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><span className="font-medium text-foreground">Destinatario:</span> {response.destinatario}</p>
              <p><span className="font-medium text-foreground">Correos:</span> {response.correos.join(", ")}</p>
              <p><span className="font-medium text-foreground">Asunto:</span> {response.asunto}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo envío
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
