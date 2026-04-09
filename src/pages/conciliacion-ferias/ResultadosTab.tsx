import { useState } from "react";
import {
  Download,
  Package,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Search,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { exportarExcel } from "./api";
import type { ConciliacionResponse, ConciliacionParams } from "./types";

interface ResultadosTabProps {
  data: ConciliacionResponse | null;
  params: ConciliacionParams | null;
}

const ESTADO_STYLES = {
  ok: {
    label: "OK",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  faltante: {
    label: "Faltante",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  sobrante: {
    label: "Sobrante",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
};

export function ResultadosTab({ data, params }: ResultadosTabProps) {
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [exportando, setExportando] = useState(false);

  if (!data || !params) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center py-12">
            Ejecuta una conciliacion para ver resultados aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { resumen, items, archivo_enviado, archivo_devuelto } = data;

  const filteredItems = items.filter((item) => {
    if (filtroEstado !== "todos" && item.estado !== filtroEstado)
      return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        item.sku.toLowerCase().includes(q) ||
        item.titulo.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = async () => {
    setExportando(true);
    try {
      const blob = await exportarExcel(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Conciliacion_${resumen.location.replace(/ /g, "_")}_${resumen.fecha_inicio}_${resumen.fecha_fin}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Excel descargado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al exportar",
      );
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas resumen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/40">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Enviado
                </p>
                <p className="text-2xl font-bold">
                  {resumen.total_enviado}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/40">
                <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Devuelto
                </p>
                <p className="text-2xl font-bold">
                  {resumen.total_devuelto}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/40">
                <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Vendido
                </p>
                <p className="text-2xl font-bold">
                  {resumen.total_vendido}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "rounded-lg p-2",
                  resumen.total_diferencia > 0
                    ? "bg-red-100 dark:bg-red-900/40"
                    : "bg-green-100 dark:bg-green-900/40",
                )}
              >
                <AlertTriangle
                  className={cn(
                    "h-5 w-5",
                    resumen.total_diferencia > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400",
                  )}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Diferencia Total
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    resumen.total_diferencia > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400",
                  )}
                >
                  {resumen.total_diferencia}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats rapidos */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-sm">
          {resumen.total_skus} SKUs procesados
        </Badge>
        <Badge
          variant="secondary"
          className="text-sm bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1" />
          {resumen.skus_ok} OK
        </Badge>
        <Badge
          variant="secondary"
          className="text-sm bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          {resumen.skus_faltante} Faltantes
        </Badge>
        <Badge
          variant="secondary"
          className="text-sm bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
        >
          <TrendingUp className="h-3.5 w-3.5 mr-1" />
          {resumen.skus_sobrante} Sobrantes
        </Badge>
      </div>

      {/* Archivos utilizados */}
      {(archivo_enviado || archivo_devuelto) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Archivos utilizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {archivo_enviado && (
                <Badge variant="outline" className="text-xs gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Enviado: {archivo_enviado}
                </Badge>
              )}
              {archivo_devuelto && (
                <Badge variant="outline" className="text-xs gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Devuelto: {archivo_devuelto}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla detalle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              Detalle por SKU
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar SKU o titulo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 h-9 w-[200px]"
                />
              </div>
              <Select
                value={filtroEstado}
                onValueChange={setFiltroEstado}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="faltante">Faltantes</SelectItem>
                  <SelectItem value="sobrante">Sobrantes</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exportando}
              >
                <Download className="h-4 w-4 mr-2" />
                {exportando ? "Exportando..." : "Exportar Excel"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Titulo</TableHead>
                  <TableHead className="text-right">Enviado</TableHead>
                  <TableHead className="text-right">Devuelto</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay items que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const estilo = ESTADO_STYLES[item.estado];
                    return (
                      <TableRow key={item.sku}>
                        <TableCell className="font-mono text-xs">
                          {item.sku}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate">
                          {item.titulo || "\u2014"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.enviado}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.devuelto}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.vendido}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            item.diferencia > 0 &&
                              "text-red-600 dark:text-red-400",
                            item.diferencia < 0 &&
                              "text-yellow-600 dark:text-yellow-400",
                          )}
                        >
                          {item.diferencia}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={estilo.className}
                          >
                            {estilo.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredItems.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando {filteredItems.length} de {items.length} items
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
