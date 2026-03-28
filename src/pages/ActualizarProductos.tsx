import { useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  Search,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import FileUploadZone from "./ingreso/FileUploadZone";
import {
  useHealthCheck,
  usePreviewUpdate,
  useApplyUpdate,
} from "./ingreso/hooks";
import { downloadTemplate, downloadBlob } from "./ingreso/api";
import { validateUpdateFile, type ValidationError } from "./ingreso/validation";
import type {
  UpdatePreviewResponse,
  UpdateApplyResponse,
} from "./ingreso/types";
import * as XLSX from "xlsx";

interface PreviewRow {
  [key: string]: unknown;
}

export default function ActualizarProductos() {
  const health = useHealthCheck();
  const previewMutation = usePreviewUpdate();
  const applyMutation = useApplyUpdate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [previewResult, setPreviewResult] = useState<UpdatePreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<UpdateApplyResponse | null>(null);

  const handleFileSelected = (f: File) => {
    setFile(f);
    previewMutation.reset();
    applyMutation.reset();
    setPreviewResult(null);
    setApplyResult(null);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<PreviewRow>(ws);
        const cols = json.length > 0 ? Object.keys(json[0]) : [];
        setTotalRows(json.length);
        setColumns(cols);
        setPreview(json.slice(0, 5));
        setValidationErrors(validateUpdateFile(json, cols));
      } catch {
        setPreview([]);
        setColumns([]);
        setTotalRows(0);
        setValidationErrors([]);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadTemplate("actualizacion");
      downloadBlob(blob, "Actualizacion_productos.xlsx");
      toast.success("Plantilla descargada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar plantilla");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handlePreview = () => {
    if (!file) return;
    setPreviewResult(null);
    setApplyResult(null);
    applyMutation.reset();
    previewMutation.mutate(file, {
      onSuccess: (data) => {
        setPreviewResult(data);
        if (data.changes > 0) {
          toast.success(`${data.changes} producto${data.changes !== 1 ? "s" : ""} con cambios detectados`);
        } else {
          toast.info("No se detectaron cambios");
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Error al consultar cambios");
      },
    });
  };

  const handleApply = () => {
    if (!file) return;
    setApplyResult(null);
    applyMutation.mutate(file, {
      onSuccess: (data) => {
        setApplyResult(data);
        const parts: string[] = [];
        if (data.updated > 0) parts.push(`${data.updated} actualizado${data.updated !== 1 ? "s" : ""}`);
        if (data.failed > 0) parts.push(`${data.failed} con errores`);
        const msg = parts.join(", ");
        if (data.failed > 0) {
          toast.warning(msg);
        } else if (data.updated === 0) {
          toast.info("No se aplicaron cambios");
        } else {
          toast.success(msg);
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Error al aplicar cambios");
      },
    });
  };

  if (health.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-5 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (health.isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Actualizar Productos</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Actualiza productos existentes en Shopify masivamente
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexión</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            No se pudo conectar con el servidor.
            <Button variant="outline" size="sm" onClick={() => health.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Actualizar Productos</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Actualiza productos existentes en Shopify masivamente
        </p>
      </div>

      {/* Paso 1: Descargar Plantilla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paso 1 — Descargar Plantilla</CardTitle>
          <CardDescription>
            Descarga la plantilla Excel, llénala solo con las columnas que necesitas
            actualizar (SKU o ID es obligatorio).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
            {downloadingTemplate ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar Plantilla
          </Button>
        </CardContent>
      </Card>

      {/* Paso 2: Subir Archivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paso 2 — Subir Archivo</CardTitle>
          <CardDescription>
            Sube el archivo Excel con SKU o ID + solo las columnas a actualizar.
            Las columnas no incluidas no se modificarán.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadZone
            title="Archivo de Actualización"
            hint="Arrastra o haz clic para seleccionar un archivo .xlsx"
            fileName={file?.name}
            isLoaded={!!file}
            onFileSelected={handleFileSelected}
          />

          {file && totalRows > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {totalRows} producto{totalRows !== 1 && "s"}
                </Badge>
                <Badge variant="outline">{columns.length} columnas</Badge>
                {validationErrors.length === 0 && (
                  <Badge className="bg-green-600 text-white hover:bg-green-700">
                    Archivo válido
                  </Badge>
                )}
              </div>

              <ScrollArea className="w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((col) => (
                          <TableCell key={col} className="whitespace-nowrap max-w-[200px] truncate">
                            {row[col] != null ? String(row[col]) : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              {totalRows > 5 && (
                <p className="text-xs text-muted-foreground">Mostrando 5 de {totalRows} filas</p>
              )}

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {validationErrors.length} error{validationErrors.length !== 1 && "es"} encontrado{validationErrors.length !== 1 && "s"}
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                      {validationErrors.slice(0, 20).map((err, i) => (
                        <li key={i}>{err.message}</li>
                      ))}
                    </ul>
                    {validationErrors.length > 20 && (
                      <p className="mt-1 text-xs">...y {validationErrors.length - 20} errores más</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 3: Vista Previa de Cambios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paso 3 — Vista Previa de Cambios</CardTitle>
          <CardDescription>
            Consulta los datos actuales en Shopify y compáralos con los nuevos valores
            antes de aplicar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handlePreview}
            disabled={!file || validationErrors.length > 0 || previewMutation.isPending}
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Consultar Cambios
          </Button>

          {previewMutation.isPending && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-muted-foreground">Consultando productos en Shopify...</p>
            </div>
          )}

          {previewMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {previewMutation.error instanceof Error ? previewMutation.error.message : "Error al consultar"}
              </AlertDescription>
            </Alert>
          )}

          {previewResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary">{previewResult.found} encontrado{previewResult.found !== 1 && "s"}</Badge>
                {previewResult.not_found > 0 && (
                  <Badge variant="destructive">{previewResult.not_found} no encontrado{previewResult.not_found !== 1 && "s"}</Badge>
                )}
                <Badge variant={previewResult.changes > 0 ? "default" : "outline"}>
                  {previewResult.changes} con cambios
                </Badge>
                {previewResult.no_changes > 0 && (
                  <Badge variant="outline">{previewResult.no_changes} sin cambios</Badge>
                )}
              </div>

              {previewResult.not_found_skus.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Productos no encontrados</AlertTitle>
                  <AlertDescription>
                    SKUs no encontrados en Shopify: {previewResult.not_found_skus.join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              {previewResult.preview.length > 0 && (
                <ScrollArea className="w-full max-h-[400px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">SKU</TableHead>
                        <TableHead className="whitespace-nowrap">Título</TableHead>
                        <TableHead className="whitespace-nowrap">Campo</TableHead>
                        <TableHead className="whitespace-nowrap">Valor Actual</TableHead>
                        <TableHead className="whitespace-nowrap">
                          <ArrowRight className="inline h-3 w-3 mr-1" />
                          Valor Nuevo
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResult.preview.flatMap((product) =>
                        product.fields.map((field, fi) => (
                          <TableRow key={`${product.sku}-${fi}`}>
                            {fi === 0 ? (
                              <>
                                <TableCell rowSpan={product.fields.length} className="font-mono text-sm align-top">
                                  {product.sku}
                                </TableCell>
                                <TableCell rowSpan={product.fields.length} className="max-w-[200px] truncate align-top">
                                  {product.title}
                                </TableCell>
                              </>
                            ) : null}
                            <TableCell className="font-medium">{field.field}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {field.current || <span className="italic">vacío</span>}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate font-medium text-green-600 dark:text-green-400">
                              {field.new}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 4: Aplicar en Shopify */}
      <Card className={!previewResult || previewResult.changes === 0 ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">Paso 4 — Aplicar en Shopify</CardTitle>
          <CardDescription>
            {previewResult && previewResult.changes > 0
              ? `${previewResult.changes} producto${previewResult.changes !== 1 ? "s" : ""} será${previewResult.changes !== 1 ? "n" : ""} actualizado${previewResult.changes !== 1 ? "s" : ""} en Shopify.`
              : "Primero consulta los cambios en el paso 3."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleApply}
            disabled={!file || !previewResult || previewResult.changes === 0 || applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            {applyMutation.isPending ? "Aplicando cambios..." : "Aplicar Cambios"}
          </Button>

          {applyMutation.isPending && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-muted-foreground">Actualizando productos en Shopify...</p>
            </div>
          )}

          {applyMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {applyMutation.error instanceof Error ? applyMutation.error.message : "Error al aplicar cambios"}
              </AlertDescription>
            </Alert>
          )}

          {applyResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={applyResult.failed === 0 ? "default" : "secondary"}>
                  {applyResult.updated} actualizado{applyResult.updated !== 1 && "s"}
                </Badge>
                {applyResult.failed > 0 && (
                  <Badge variant="destructive">{applyResult.failed} con errores</Badge>
                )}
                <Badge variant="outline">{applyResult.total} total</Badge>
              </div>

              <ScrollArea className="w-full max-h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Estado</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applyResult.results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.sku}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{r.title}</TableCell>
                        <TableCell className="max-w-[300px] text-sm text-muted-foreground truncate">
                          {r.success
                            ? (r.fields_updated ?? []).join(", ")
                            : r.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
