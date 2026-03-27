import { useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  Rocket,
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
} from "./ingreso/hooks";
import { downloadTemplate, downloadBlob } from "./ingreso/api";
import * as XLSX from "xlsx";

interface PreviewRow {
  [key: string]: unknown;
}

export default function CrearProductos() {
  const health = useHealthCheck();
  const processMutation = useProcessCreateProducts();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleFileSelected = (f: File) => {
    setFile(f);
    processMutation.reset();

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
        downloadBlob(blob, "resultado_crear_productos.xlsx");
        toast.success("Productos procesados y descargados");
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Error al procesar productos",
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
          <CardTitle className="text-lg">
            Paso 2 — Subir Archivo
          </CardTitle>
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
            Paso 3 — Procesar y Descargar
          </CardTitle>
          <CardDescription>
            Transforma los datos al formato Shopify y descarga el resultado.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <Alert className="mt-4">
              <AlertTitle>Listo</AlertTitle>
              <AlertDescription>
                El archivo fue procesado y descargado exitosamente.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
