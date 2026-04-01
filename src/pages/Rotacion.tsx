import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, TrendingUp, Package, ShoppingCart, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  startTurnover,
  getTurnoverStatus,
  type TurnoverStatus,
  type SedeRotacion,
} from "./rotacion/api";

const PHASE_LABELS: Record<string, string> = {
  locations: "Buscando sedes...",
  inventory: "Consultando inventario actual...",
  bulk_start: "Iniciando consulta de ventas...",
  bulk_poll: "Procesando ventas (puede tomar unos minutos)...",
  processing: "Calculando rotación...",
};

const PHASE_PROGRESS: Record<string, number> = {
  locations: 10,
  inventory: 30,
  bulk_start: 50,
  bulk_poll: 70,
  processing: 90,
};

function formatNumber(n: number): string {
  return n.toLocaleString("es-CO");
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

function getRotacionBadge(rotacion: number | null) {
  if (rotacion === null) return <Badge variant="outline">Sin datos</Badge>;
  if (rotacion >= 4) return <Badge className="bg-green-600 hover:bg-green-600 text-white">{rotacion.toFixed(1)}x</Badge>;
  if (rotacion >= 2) return <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white">{rotacion.toFixed(1)}x</Badge>;
  if (rotacion >= 1) return <Badge className="bg-orange-500 hover:bg-orange-500 text-white">{rotacion.toFixed(1)}x</Badge>;
  return <Badge variant="destructive">{rotacion.toFixed(1)}x</Badge>;
}

function getDiasLabel(dias: number | null) {
  if (dias === null) return "—";
  if (dias <= 90) return <span className="text-green-600 dark:text-green-400 font-medium">{dias}d</span>;
  if (dias <= 180) return <span className="text-yellow-600 dark:text-yellow-400 font-medium">{dias}d</span>;
  if (dias <= 365) return <span className="text-orange-600 dark:text-orange-400 font-medium">{dias}d</span>;
  return <span className="text-red-600 dark:text-red-400 font-medium">{dias}d</span>;
}

export default function Rotacion() {
  const [status, setStatus] = useState<TurnoverStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [months, setMonths] = useState("12");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlight = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    if (pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const s = await getTurnoverStatus();
      setStatus(s);
      if (!s.running) {
        stopPolling();
        if (s.error) {
          toast.error(`Error: ${s.error}`);
        } else if (s.result) {
          toast.success("Rotacion calculada exitosamente");
        }
      }
    } catch {
      // Silently retry on poll errors
    } finally {
      pollInFlight.current = false;
    }
  }, [stopPolling]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      await startTurnover(Number(months));
      toast.info("Calculo iniciado, esto puede tomar unos minutos...");

      // Start polling
      stopPolling();
      pollRef.current = setInterval(pollStatus, 4000);
      // Immediate first poll
      setTimeout(pollStatus, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar");
    } finally {
      setIsStarting(false);
    }
  }, [months, pollStatus, stopPolling]);

  // Check status on mount (in case there's a running or completed job)
  useEffect(() => {
    getTurnoverStatus().then((s) => {
      setStatus(s);
      if (s.running) {
        pollRef.current = setInterval(pollStatus, 4000);
      }
    }).catch(() => {});
    return stopPolling;
  }, [pollStatus, stopPolling]);

  const result = status?.result;
  const isRunning = status?.running ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rotacion de Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Analisis de rotacion por sede — unidades vendidas vs inventario actual
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Periodo de ventas</label>
              <Select value={months} onValueChange={setMonths} disabled={isRunning}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Ultimos 3 meses</SelectItem>
                  <SelectItem value="6">Ultimos 6 meses</SelectItem>
                  <SelectItem value="12">Ultimos 12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleStart} disabled={isRunning || isStarting}>
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isRunning ? "Calculando..." : "Calcular Rotacion"}
            </Button>
          </div>

          {/* Progress */}
          {isRunning && status?.phase && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{PHASE_LABELS[status.phase] ?? status.phase}</span>
                <span className="font-mono text-xs">{PHASE_PROGRESS[status.phase] ?? 0}%</span>
              </div>
              <Progress value={PHASE_PROGRESS[status.phase] ?? 0} />
            </div>
          )}

          {/* Error */}
          {status?.error && !isRunning && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{status.error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Inventario Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(result.totales.inventario_unidades)}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(result.totales.inventario_valor)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Vendidas ({result.periodo_meses}M)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(result.totales.vendidas_unidades)}</div>
                <p className="text-xs text-muted-foreground">COGS: {formatCurrency(result.totales.vendidas_cogs)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Rotacion Global
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {result.totales.rotacion !== null ? `${result.totales.rotacion.toFixed(1)}x` : "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Costo: {result.totales.rotacion_costo !== null ? `${result.totales.rotacion_costo.toFixed(1)}x` : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Dias de Inventario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {result.totales.dias_inventario !== null ? `${result.totales.dias_inventario}` : "—"}
                </div>
                <p className="text-xs text-muted-foreground">Promedio global</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-sede Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalle por Sede</CardTitle>
              <p className="text-sm text-muted-foreground">
                Calculado el {new Date(result.fecha_calculo).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Sede</th>
                      <th className="pb-3 font-medium text-right">Inventario</th>
                      <th className="pb-3 font-medium text-right">Valor Inv.</th>
                      <th className="pb-3 font-medium text-right">SKUs Inv.</th>
                      <th className="pb-3 font-medium text-right">Vendidas</th>
                      <th className="pb-3 font-medium text-right">COGS</th>
                      <th className="pb-3 font-medium text-center">Rotacion</th>
                      <th className="pb-3 font-medium text-center">Rot. Costo</th>
                      <th className="pb-3 font-medium text-center">Dias Inv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sedes.map((sede: SedeRotacion) => (
                      <tr key={sede.sede} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 font-medium">{sede.sede}</td>
                        <td className="py-3 text-right tabular-nums">{formatNumber(sede.inventario_unidades)}</td>
                        <td className="py-3 text-right tabular-nums">{formatCurrency(sede.inventario_valor)}</td>
                        <td className="py-3 text-right tabular-nums">{formatNumber(sede.inventario_skus)}</td>
                        <td className="py-3 text-right tabular-nums">{formatNumber(sede.vendidas_unidades)}</td>
                        <td className="py-3 text-right tabular-nums">{formatCurrency(sede.vendidas_cogs)}</td>
                        <td className="py-3 text-center">{getRotacionBadge(sede.rotacion)}</td>
                        <td className="py-3 text-center">{getRotacionBadge(sede.rotacion_costo)}</td>
                        <td className="py-3 text-center">{getDiasLabel(sede.dias_inventario)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="pt-3">Total</td>
                      <td className="pt-3 text-right tabular-nums">{formatNumber(result.totales.inventario_unidades)}</td>
                      <td className="pt-3 text-right tabular-nums">{formatCurrency(result.totales.inventario_valor)}</td>
                      <td className="pt-3 text-right"></td>
                      <td className="pt-3 text-right tabular-nums">{formatNumber(result.totales.vendidas_unidades)}</td>
                      <td className="pt-3 text-right tabular-nums">{formatCurrency(result.totales.vendidas_cogs)}</td>
                      <td className="pt-3 text-center">{getRotacionBadge(result.totales.rotacion)}</td>
                      <td className="pt-3 text-center">{getRotacionBadge(result.totales.rotacion_costo)}</td>
                      <td className="pt-3 text-center">{getDiasLabel(result.totales.dias_inventario)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-3">Interpretacion</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600 hover:bg-green-600 text-white">4x+</Badge>
                  Excelente — alta demanda, inventario eficiente
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white">2-4x</Badge>
                  Bueno — ritmo saludable para libros
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500 hover:bg-orange-500 text-white">1-2x</Badge>
                  Regular — posible exceso de inventario
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">&lt;1x</Badge>
                  Bajo — revisar titulos de baja rotacion
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <strong>Rotacion</strong> = Unidades vendidas / Inventario actual.{" "}
                <strong>Rot. Costo</strong> = COGS / Valor inventario.{" "}
                <strong>Dias Inv.</strong> = Dias que duraria el stock al ritmo actual de ventas.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!result && !isRunning && !status?.error && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-medium text-lg mb-1">Sin datos de rotacion</h3>
            <p className="text-sm text-muted-foreground">
              Selecciona un periodo y presiona "Calcular Rotacion" para obtener el analisis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
