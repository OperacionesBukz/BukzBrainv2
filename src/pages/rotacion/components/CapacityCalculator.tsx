import { useState } from "react";
import { Package, AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SedeRotacion } from "../types";

interface CapacityCalculatorProps {
  sedes: SedeRotacion[];
}

function fmt(n: number): string {
  return n.toLocaleString("es-CO");
}

export default function CapacityCalculator({ sedes }: CapacityCalculatorProps) {
  const [diasCobertura, setDiasCobertura] = useState(90);
  const [numTitulos, setNumTitulos] = useState(0);
  const [pctNovedades, setPctNovedades] = useState(30);

  const sedeCapacities = sedes.map((s) => {
    const stockObjetivo = Math.round(s.venta_diaria * diasCobertura);
    const diff = stockObjetivo - s.inventario_unidades;
    return {
      sede: s.sede,
      venta_diaria: s.venta_diaria,
      inventario: s.inventario_unidades,
      stock_objetivo: stockObjetivo,
      capacidad_reposicion: Math.max(0, diff),
      sobrestock: Math.max(0, -diff),
    };
  });

  const totalCapacidad = sedeCapacities.reduce((s, c) => s + c.capacidad_reposicion, 0);
  const totalSobrestock = sedeCapacities.reduce((s, c) => s + c.sobrestock, 0);
  const topeNovedades = Math.round(totalCapacidad * (pctNovedades / 100));
  const unidadesPorTitulo = numTitulos > 0 ? Math.floor(topeNovedades / numTitulos) : 0;

  return (
    <div className="space-y-6">
      {/* Slider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Capacidad de Compra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Dias de cobertura objetivo</label>
              <span className="text-sm font-bold text-primary">{diasCobertura} dias</span>
            </div>
            <Slider
              value={[diasCobertura]}
              onValueChange={([v]) => setDiasCobertura(v)}
              min={30}
              max={180}
              step={15}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>30d</span>
              <span>90d</span>
              <span>180d</span>
            </div>
          </div>

          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
              <p className="text-sm text-muted-foreground">Capacidad total de reposicion</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {fmt(totalCapacidad)} u
              </p>
            </div>
            {totalSobrestock > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Sobre-stock total
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {fmt(totalSobrestock)} u
                </p>
              </div>
            )}
          </div>

          {/* Per-sede breakdown */}
          <div className="grid gap-3 sm:grid-cols-2">
            {sedeCapacities.map((c) => (
              <div
                key={c.sede}
                className={cn(
                  "rounded-lg border p-3 space-y-1",
                  c.sobrestock > 0 && "border-red-200 dark:border-red-800",
                )}
              >
                <p className="font-medium text-sm">{c.sede.replace("Bukz ", "")}</p>
                <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                  <span>Stock actual</span>
                  <span className="text-right font-medium text-foreground">
                    {fmt(c.inventario)}
                  </span>
                  <span>Stock objetivo</span>
                  <span className="text-right font-medium text-foreground">
                    {fmt(c.stock_objetivo)}
                  </span>
                </div>
                {c.capacidad_reposicion > 0 ? (
                  <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    Capacidad: {fmt(c.capacidad_reposicion)} u
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                    Sobre-stock: {fmt(c.sobrestock)} u
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Novedades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Tope de Novedades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">% de capacidad para novedades</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={pctNovedades}
                onChange={(e) => setPctNovedades(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Numero de titulos nuevos</label>
              <Input
                type="number"
                min={0}
                value={numTitulos || ""}
                onChange={(e) => setNumTitulos(Number(e.target.value) || 0)}
                placeholder="Ej: 50"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-4">
              <p className="text-sm text-muted-foreground">Tope novedades</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {fmt(topeNovedades)} u
              </p>
              <p className="text-xs text-muted-foreground">
                {pctNovedades}% de {fmt(totalCapacidad)} u
              </p>
            </div>
            {numTitulos > 0 && (
              <>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-sm text-muted-foreground">Unidades por titulo</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {fmt(unidadesPorTitulo)} u
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {numTitulos} titulos nuevos
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4">
                  <p className="text-sm text-muted-foreground">Capacidad reposicion</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {fmt(totalCapacidad - topeNovedades)} u
                  </p>
                  <p className="text-xs text-muted-foreground">
                    restante para reposicion
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
