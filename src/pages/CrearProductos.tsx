import { useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  Rocket,
  ShoppingCart,
  CheckCircle2,
  XCircle,
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
  useProcessCreateProducts,
  useCreateProductsInShopify,
} from "./ingreso/hooks";
import { downloadTemplate, downloadBlob } from "./ingreso/api";
import type { ShopifyCreateResponse } from "./ingreso/types";
import * as XLSX from "xlsx";

interface PreviewRow {
  [key: string]: unknown;
}

export default function CrearProductos() {
  const health = useHealthCheck();
  const processMutation = useProcessCreateProducts();
  const shopifyMutation = useCreateProductsInShopify();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [shopifyResult, setShopifyResult] =
    useState<ShopifyCreateResponse | null>(null);

  const handleFileSelected = (f: File) => {
    setFile(f);
    processMutation.reset();
    shopifyMutation.reset();
    setProcessedBlob(null);
    setShopifyResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<PreviewRow>(ws);
        setTotalRows(json.length);
        setColumns(json.length > 0 ? Object.keys(json[0]) : []);
        setPreview(json.slice(0, 5));
      } catch {
        setPreview([]);
        setColumns([]);
        setTotalRows(0);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadTemplate("creacion");
      downloadBlob(blob, "Creacion_productos.xlsx");
      toast.success("Plantilla descargada");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al descargar plantilla",
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleProcess = () => {
    if (!file) return;
    processMutation.mutate(file, {
      onSuccess: (blob) => {
        setProcessedBlob(blob);
        toast.success("Productos procesados correctamente");
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Error al procesar productos",
        );
      },
    });
  };

  const handleCreateInShopify = () => {
    if (!file) return;
    setShopifyResult(null);
    shopifyMutation.mutate(file, {
      onSuccess: (data) => {
        setShopifyResult(data);
        if (data.failed === 0) {
          toast.success(`${data.created} producto${data.created !== 1 ? "s" : ""} creado${data.created !== 1 ? "s" : ""} en Shopify`);
        } else {
          toast.warning(
            `${data.created} creados, ${data.failed} con errores`,
          );
        }
      },
      onError: (err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Error al crear productos en Shopify",
        );
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
          <h1 className="text-2xl md:text-3xl font-semibold">
            Crear Productos
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            Transforma tu plantilla al formato de importación Shopify
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexión</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            No se pudo conectar con el servidor.
            <Button
              variant="outline"
              size="sm"
              onClick={() => health.refetch()}
            >
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
        <h1 className="text-2xl md:text-3xl font-semibold">
          Crear Productos
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Transforma tu plantilla al formato de importación Shopify
        </p>
      </div>

      {/* Paso 1: Descargar Plantilla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Paso 1 — Descargar Plantilla
          </CardTitle>
          <CardDescription>
            Descarga la plantilla Excel con las 18 columnas requeridas, llénala
            con los datos de tus productos y súbela en el siguiente paso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
          >
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
            Sube el archivo Excel con los datos de productos. Columnas
            obligatorias: <strong>Titulo</strong>, <strong>SKU</strong>,{" "}
            <strong>Vendor</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadZone
            title="Archivo de Productos"
            hint="Arrastra o haz clic para seleccionar un archivo .xlsx"
            fileName={file?.name}
            isLoaded={!!file}
            onFileSelected={handleFileSelected}
          />

          {file && totalRows > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {totalRows} producto{totalRows !== 1 && "s"} encontrado
                  {totalRows !== 1 && "s"}
                </Badge>
                <Badge variant="outline">{columns.length} columnas</Badge>
              </div>

              <ScrollArea className="w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((col) => (
                          <TableCell
                            key={col}
                            className="whitespace-nowrap max-w-[200px] truncate"
                          >
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
                <p className="text-xs text-muted-foreground">
                  Mostrando 5 de {totalRows} filas
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 3: Procesar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Paso 3 — Procesar Datos
          </CardTitle>
          <CardDescription>
            Valida y transforma los datos al formato Shopify. Una vez procesado
            puedes descargar el archivo o continuar al paso 4 para crear los
            productos directamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleProcess}
            disabled={!file || processMutation.isPending}
          >
            {processMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            Procesar Productos
          </Button>

          {processMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {processMutation.error instanceof Error
                  ? processMutation.error.message
                  : "Error al procesar"}
              </AlertDescription>
            </Alert>
          )}

          {processMutation.isSuccess && (
            <div className="flex items-center gap-3 mt-4">
              <Alert className="flex-1">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Datos procesados correctamente</AlertTitle>
                <AlertDescription>
                  Puedes descargar el archivo transformado o continuar al paso 4
                  para crear los productos en Shopify.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                onClick={() => {
                  if (processedBlob)
                    downloadBlob(processedBlob, "resultado_crear_productos.xlsx");
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 4: Crear en Shopify */}
      <Card className={!processMutation.isSuccess ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">
            Paso 4 — Crear en Shopify
          </CardTitle>
          <CardDescription>
            {processMutation.isSuccess
              ? "Los datos fueron validados. Crea los productos directamente en Shopify."
              : "Primero procesa los datos en el paso 3 para habilitar este paso."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleCreateInShopify}
            disabled={!file || !processMutation.isSuccess || shopifyMutation.isPending}
            variant="default"
          >
            {shopifyMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            {shopifyMutation.isPending
              ? "Creando productos..."
              : "Crear en Shopify"}
          </Button>

          {shopifyMutation.isPending && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-muted-foreground">
                Creando {totalRows} producto{totalRows !== 1 && "s"} en
                Shopify...
              </p>
            </div>
          )}

          {shopifyMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {shopifyMutation.error instanceof Error
                  ? shopifyMutation.error.message
                  : "Error al crear productos en Shopify"}
              </AlertDescription>
            </Alert>
          )}

          {shopifyResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant={shopifyResult.failed === 0 ? "default" : "secondary"}
                >
                  {shopifyResult.created} creado
                  {shopifyResult.created !== 1 && "s"}
                </Badge>
                {shopifyResult.failed > 0 && (
                  <Badge variant="destructive">
                    {shopifyResult.failed} con errores
                  </Badge>
                )}
                <Badge variant="outline">{shopifyResult.total} total</Badge>
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
                    {shopifyResult.results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {r.sku}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate">
                          {r.title}
                        </TableCell>
                        <TableCell className="max-w-[300px] text-sm text-muted-foreground truncate">
                          {r.success
                            ? r.shopify_id?.split("/").pop() ?? "OK"
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
