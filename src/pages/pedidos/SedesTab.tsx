import { useState, useCallback, useMemo } from "react";
import { Loader2, RotateCcw, CheckCircle2, MapPin } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import FileUploadField from "../devoluciones/FileUploadField";
import { usePedidosConfig, useEnviarPedidoSede } from "./hooks";
import { logPedido } from "./api";
import { ANIOS } from "./types";
import type { PedidoResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function SedesTab() {
  const [step, setStep] = useState<Step>("config");
  const [proveedor, setProveedor] = useState("");
  const [sede, setSede] = useState("");
  const [tipo, setTipo] = useState("");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [remitente, setRemitente] = useState("Pedidos Bukz");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [response, setResponse] = useState<PedidoResponse | null>(null);

  const { user } = useAuth();
  const { data: config, isLoading: configLoading } = usePedidosConfig();
  const mutation = useEnviarPedidoSede();

  const sedeInfo = useMemo(
    () => (sede && config?.sedes_info ? config.sedes_info[sede] : null),
    [sede, config],
  );

  const canSubmit = proveedor && sede && tipo && mes && anio && archivo && remitente;

  const handleSubmit = useCallback(() => {
    if (!proveedor || !sede || !tipo || !mes || !anio || !archivo || !remitente)
      return;

    setStep("processing");
    mutation.mutate(
      {
        proveedor,
        sede,
        tipo,
        mes,
        anio,
        remitente,
        archivo,
        enviadoPor: user?.email ?? "",
      },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(`Pedido enviado a ${data.proveedor}`);
          setStep("results");
          logPedido({
            tipo: "sede",
            proveedor: data.proveedor,
            destino: sede,
            tipoPedido: tipo,
            mes,
            anio,
            correos: data.correos,
            nombreArchivo: archivo.name,
            asunto: data.asunto,
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "enviado",
          }).catch((e) => console.error("Error al registrar log:", e));
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar pedido",
          );
          setStep("config");
          logPedido({
            tipo: "sede",
            proveedor,
            destino: sede,
            tipoPedido: tipo,
            mes,
            anio,
            correos: [],
            nombreArchivo: archivo.name,
            asunto: "",
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "error",
            detalle: err instanceof Error ? err.message : "Error desconocido",
          }).catch((e) => console.error("Error al registrar log:", e));
        },
      },
    );
  }, [proveedor, sede, tipo, mes, anio, archivo, remitente, mutation, user]);

  const handleReset = useCallback(() => {
    setStep("config");
    setProveedor("");
    setSede("");
    setTipo("");
    setMes("");
    setAnio(String(new Date().getFullYear()));
    setArchivo(null);
    setResponse(null);
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={proveedor} onValueChange={setProveedor} disabled={configLoading}>
                <SelectTrigger>
                  {configLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                    </span>
                  ) : (
                    <SelectValue placeholder="Seleccionar proveedor" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {config?.proveedores.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sede destino</Label>
              <Select value={sede} onValueChange={setSede} disabled={configLoading}>
                <SelectTrigger>
                  {configLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                    </span>
                  ) : (
                    <SelectValue placeholder="Seleccionar sede" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {config?.sedes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tipo de pedido</Label>
              <Select value={tipo} onValueChange={setTipo} disabled={configLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {config?.tipos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Mes</Label>
              <Select value={mes} onValueChange={setMes} disabled={configLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {config?.meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Año</Label>
              <Select value={anio} onValueChange={setAnio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANIOS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sedeInfo && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium text-foreground">Dirección:</span>{" "}
                      {sedeInfo.direccion}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Horario:</span>{" "}
                      {sedeInfo.horario}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="remitente-sede">Remitente</Label>
            <Input
              id="remitente-sede"
              value={remitente}
              onChange={(e) => setRemitente(e.target.value)}
            />
          </div>

          <FileUploadField
            label="Archivo Excel del pedido"
            description="Formato aceptado: xlsx"
            accept=".xlsx"
            fileName={archivo?.name ?? null}
            onFileSelected={setArchivo}
            onClear={() => setArchivo(null)}
          />

          <Button onClick={handleSubmit} disabled={!canSubmit || configLoading}>
            Enviar pedido
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando pedido al proveedor...
          </p>
        </div>
      )}

      {step === "results" && response && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Pedido enviado correctamente</span>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Proveedor:</span>{" "}
                {response.proveedor}
              </p>
              <p>
                <span className="font-medium text-foreground">Sede:</span>{" "}
                {response.sede}
              </p>
              <p>
                <span className="font-medium text-foreground">Correos:</span>{" "}
                {response.correos.join(", ")}
              </p>
              <p>
                <span className="font-medium text-foreground">Asunto:</span>{" "}
                {response.asunto}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo pedido
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
