import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Download, Save, RotateCcw, Upload } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Separator } from "@/components/ui/separator";
import FileUploadZone from "@/pages/ingreso/FileUploadZone";
import { SummaryCards } from "./SummaryCards";
import { CmvTable } from "./CmvTable";
import type { CmvProduct, CmvTotals, VendorBreakdown } from "../types";

interface ResultsStepProps {
  products: CmvProduct[];
  totals: CmvTotals;
  onExport: (month: number, year: number) => void;
  onSaveHistory: (month: number, year: number) => void;
  onImportCompleted: (file: File) => void;
  onReset: () => void;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatCop(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export function ResultsStep({
  products,
  totals,
  onExport,
  onSaveHistory,
  onImportCompleted,
  onReset,
}: ResultsStepProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Calcular breakdown por vendor
  const vendorBreakdown = useMemo<VendorBreakdown[]>(() => {
    const map = new Map<string, VendorBreakdown>();
    for (const p of products) {
      const key = p.vendor || "Sin vendor";
      const existing = map.get(key);
      if (existing) {
        existing.ventas += p.valorTotal;
        existing.costo += p.costoTotal;
        existing.items += 1;
      } else {
        map.set(key, {
          vendor: key,
          ventas: p.valorTotal,
          costo: p.costoTotal,
          items: 1,
          margen: 0,
        });
      }
    }
    for (const v of map.values()) {
      v.margen = v.ventas > 0 ? ((v.ventas - v.costo) / v.ventas) * 100 : 0;
    }
    return Array.from(map.values()).sort((a, b) => b.ventas - a.ventas);
  }, [products]);

  const hasCostData = totals.totalCosto > 0;

  // Top 10 vendors para el gráfico
  const chartData = useMemo(
    () =>
      vendorBreakdown.slice(0, 10).map((v) => ({
        name: v.vendor.length > 15 ? v.vendor.slice(0, 15) + "..." : v.vendor,
        ventas: v.ventas,
      })),
    [vendorBreakdown]
  );

  // Años disponibles para el selector
  const years = useMemo(() => {
    const current = now.getFullYear();
    return [current - 2, current - 1, current, current + 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Selector de mes/año */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tarjetas resumen */}
      <SummaryCards totals={totals} />

      {/* Gráfico + Tabla breakdown */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Gráfico de barras: top 10 vendors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Vendors por Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay datos para mostrar
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => formatCop(v)}
                    className="text-xs"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12 }}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                      }),
                      "Ventas",
                    ]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabla breakdown por vendor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desglose por Vendor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[380px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    {hasCostData && <TableHead className="text-right">Costo</TableHead>}
                    {hasCostData && <TableHead className="text-right">Margen %</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={hasCostData ? 5 : 3} className="text-center py-6 text-muted-foreground">
                        Sin datos
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendorBreakdown.map((v) => (
                      <TableRow key={v.vendor}>
                        <TableCell className="font-medium max-w-[150px] truncate" title={v.vendor}>
                          {v.vendor}
                        </TableCell>
                        <TableCell className="text-right">{v.items.toLocaleString("es-CO")}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCop(v.ventas)}
                        </TableCell>
                        {hasCostData && (
                          <TableCell className="text-right whitespace-nowrap">
                            {formatCop(v.costo)}
                          </TableCell>
                        )}
                        {hasCostData && (
                          <TableCell className="text-right">{v.margen.toFixed(1)}%</TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de productos completa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <CmvTable products={products} />
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => onExport(month, year)}>
          <Download className="h-4 w-4 mr-2" />
          Exportar a Excel
        </Button>
        {hasCostData && (
          <Button variant="outline" onClick={() => onSaveHistory(month, year)}>
            <Save className="h-4 w-4 mr-2" />
            Guardar en Historial
          </Button>
        )}
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Nuevo Procesamiento
        </Button>
      </div>

      {/* Siguiente paso: importar CMV completado (solo si aún no tiene costos) */}
      {!hasCostData && (
        <>
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase">siguiente paso</span>
            <Separator className="flex-1" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-5 w-5" />
                Importar CMV completado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Descarga el Excel, llena las columnas <strong>Descuento</strong> (BUKZ / PROVEEDOR / VACIO) y <strong>Margen</strong>, y vuelve a subirlo aquí. El sistema calculará el costo automáticamente.
              </p>
              <FileUploadZone
                title="CMV con Descuento y Margen"
                hint="Sube el Excel con las columnas Descuento y Margen llenadas"
                accept=".xlsx,.xls"
                isLoaded={false}
                onFileSelected={onImportCompleted}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
