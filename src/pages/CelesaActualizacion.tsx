import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ship,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Download,
  ArrowUp,
  ArrowDown,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  uploadCelesaCsv,
  getCelesaStatus,
  cancelCelesaJob,
  importViaMatrixify,
  getMatrixifyDownloadUrl,
  type CelesaStatus,
  type CelesaDifference,
} from "./celesa/api";

const PHASE_LABELS: Record<string, string> = {
  uploading: "Subiendo CSV...",
  parsing: "Procesando CSV...",
  location: "Buscando location Dropshipping España...",
  azeta: "Descargando stock de Azeta...",
  comparing: "Comparando diferencias...",
};

function formatNumber(n: number): string {
  return n.toLocaleString("es-CO");
}

function getDiffBadge(diff: number) {
  if (diff > 0) {
    return (
      <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1">
        <ArrowUp className="h-3 w-3" />+{diff}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <ArrowDown className="h-3 w-3" />{diff}
    </Badge>
  );
}

export default function CelesaActualizacion() {
  const [status, setStatus] = useState<CelesaStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [matrixifyStarting, setMatrixifyStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlight = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const s = await getCelesaStatus();
      setStatus(s);
      if (s.applying) setMatrixifyStarting(false);
      if (!s.running && !s.applying) {
        stopPolling();
        if (s.error) {
          toast.error(`Error: ${s.error}`);
        } else if (s.differences && !s.apply_result) {
          toast.success(`${s.summary?.differences_found ?? 0} diferencias encontradas`);
        }
        if (s.apply_result) {
          if (s.apply_result.errors.length === 0) {
            toast.success(`${s.apply_result.applied} productos importados vía Matrixify`);
          } else {
            toast.warning(`${s.apply_result.applied} importados, ${s.apply_result.errors.length} errores`);
          }
        }
      }
    } catch {
      // Silently retry on poll errors
    } finally {
      pollInFlight.current = false;
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(pollStatus, 2000);
    setTimeout(pollStatus, 500);
  }, [pollStatus, stopPolling]);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Solo se aceptan archivos CSV");
      return;
    }
    setIsUploading(true);
    try {
      const res = await uploadCelesaCsv(file);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.info("Procesando CSV...");
      startPolling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir CSV");
    } finally {
      setIsUploading(false);
    }
  }, [startPolling]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleCancel = useCallback(async () => {
    try {
      await cancelCelesaJob();
      stopPolling();
      toast.info("Operación cancelada");
      const s = await getCelesaStatus();
      setStatus(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    }
  }, [stopPolling]);

  const handleMatrixifyImport = useCallback(async () => {
    setConfirmOpen(false);
    setMatrixifyStarting(true);
    try {
      const res = await importViaMatrixify();
      if (!res.success) {
        toast.error(res.message);
        setMatrixifyStarting(false);
        return;
      }
      toast.info("Preparando importación Matrixify...");
      startPolling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar vía Matrixify");
      setMatrixifyStarting(false);
    }
  }, [startPolling]);

  const handleDownloadMatrixifyExcel = useCallback(() => {
    window.open(getMatrixifyDownloadUrl(), "_blank");
  }, []);

  const handleDownloadCsv = useCallback(() => {
    if (!status?.differences) return;
    const headers = ["SKU", "Titulo", "Vendor", "Shopify Actual", "Azeta Stock", "Diferencia"];
    const rows = status.differences.map((d) => [
      d.sku,
      `"${d.title.replace(/"/g, '""')}"`,
      d.vendor,
      d.shopify_qty,
      d.azeta_qty,
      d.diff,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `celesa_diferencias_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [status?.differences]);

  useEffect(() => {
    getCelesaStatus()
      .then((s) => {
        setStatus(s);
        if (s.running || s.applying) {
          startPolling();
        }
      })
      .catch(() => {});
    return stopPolling;
  }, [startPolling, stopPolling]);

  const differences = status?.differences;
  const summary = status?.summary;
  const isRunning = status?.running ?? false;
  const isApplying = status?.applying ?? false;
  const applyResult = status?.apply_result;
  const isBusy = isRunning || isApplying || matrixifyStarting;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Ship className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Actualización Celesa</h1>
          <p className="text-sm text-muted-foreground">
            Sincronizar inventario Dropshipping España con stock de Azeta
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy || isUploading}
            >
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {isRunning ? "Procesando..." : "Subir CSV de Shopify"}
            </Button>

            {isBusy && (
              <Button variant="outline" onClick={handleCancel}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            )}

            {differences && differences.length > 0 && !applyResult && (
              <>
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isBusy}
                >
                  {(isApplying || matrixifyStarting) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {matrixifyStarting
                    ? "Preparando Matrixify..."
                    : isApplying
                      ? "Importando vía Matrixify..."
                      : `Importar ${differences.length} vía Matrixify`}
                </Button>
                <Button variant="outline" onClick={handleDownloadMatrixifyExcel} disabled={isBusy}>
                  <Download className="mr-2 h-4 w-4" />
                  Excel Matrixify
                </Button>
                <Button variant="outline" onClick={handleDownloadCsv} disabled={isBusy}>
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </>
            )}
          </div>

          {/* Uploading spinner (before polling starts) */}
          {isUploading && !isRunning && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Subiendo archivo...</span>
            </div>
          )}

          {/* Progress bar */}
          {isRunning && status?.phase && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{PHASE_LABELS[status.phase] ?? status.phase}</span>
              </div>
              <Progress value={60} className="animate-pulse" />
            </div>
          )}

          {/* Matrixify starting (before polling picks up) */}
          {matrixifyStarting && !isApplying && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Preparando importación Matrixify (generando Excel y subiendo archivo)...</span>
              </div>
              <Progress value={30} className="animate-pulse" />
            </div>
          )}

          {/* Apply progress */}
          {isApplying && status?.apply_phase && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{status.apply_phase}</span>
              </div>
              <Progress value={60} className="animate-pulse" />
            </div>
          )}

          {/* Error */}
          {(status?.error || status?.apply_error) && !isRunning && !isApplying && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{status?.error ?? status?.apply_error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Result */}
      {applyResult && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {applyResult.applied} de {applyResult.total} productos importados vía Matrixify
                </p>
                {applyResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-destructive font-medium">
                      {applyResult.errors.length} errores:
                    </p>
                    {applyResult.errors.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{e}</p>
                    ))}
                    {applyResult.errors.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ...y {applyResult.errors.length - 5} más
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SKUs Azeta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(summary.total_azeta_skus)}</div>
              <p className="text-xs text-muted-foreground">productos en catálogo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Items Shopify</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(summary.total_shopify_items)}</div>
              <p className="text-xs text-muted-foreground">en Dropshipping España</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Diferencias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(summary.differences_found)}</div>
              <p className="text-xs text-muted-foreground">productos con cambio de stock</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Differences Table */}
      {differences && differences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Diferencias de Inventario</CardTitle>
            <p className="text-sm text-muted-foreground">
              Productos donde el stock de Azeta difiere del inventario en Shopify
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">SKU</th>
                    <th className="pb-3 font-medium">Título</th>
                    <th className="pb-3 font-medium text-right">Shopify</th>
                    <th className="pb-3 font-medium text-right">Azeta</th>
                    <th className="pb-3 font-medium text-center">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {differences.map((d: CelesaDifference) => (
                    <tr key={d.sku} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 font-mono text-xs">{d.sku}</td>
                      <td className="py-2.5 max-w-[300px] truncate" title={d.title}>{d.title}</td>
                      <td className="py-2.5 text-right tabular-nums">{d.shopify_qty}</td>
                      <td className="py-2.5 text-right tabular-nums font-medium">{d.azeta_qty}</td>
                      <td className="py-2.5 text-center">{getDiffBadge(d.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state when differences is empty array */}
      {differences && differences.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600/40 mb-4" />
            <h3 className="font-medium text-lg mb-1">Inventario sincronizado</h3>
            <p className="text-sm text-muted-foreground">
              No se encontraron diferencias entre Azeta y Shopify.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Drop zone / Initial empty state */}
      {!differences && !isRunning && !status?.error && (
        <Card
          className={cn(
            "cursor-pointer border-2 border-dashed transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
          onClick={() => !isBusy && !isUploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="py-12 text-center">
            {isUploading ? (
              <>
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
                <h3 className="font-medium text-lg mb-1">Subiendo archivo...</h3>
                <p className="text-sm text-muted-foreground">
                  Procesando CSV y descargando stock de Azeta
                </p>
              </>
            ) : (
              <>
                <FileUp className={cn(
                  "h-12 w-12 mx-auto mb-4 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground/40"
                )} />
                <h3 className="font-medium text-lg mb-1">
                  {isDragging ? "Suelta el archivo aquí" : "Arrastra tu CSV de Shopify aquí"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  o haz clic para seleccionar archivo
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importación Matrixify</AlertDialogTitle>
            <AlertDialogDescription>
              Se importarán <strong>{differences?.length ?? 0} cambios de inventario</strong> a
              la location "Dropshipping [España]" vía Matrixify. Matrixify actualizará el stock en Shopify.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMatrixifyImport}>
              Importar vía Matrixify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
