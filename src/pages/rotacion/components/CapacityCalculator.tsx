import { useState } from "react";
import { Package, AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCountUp } from "../useCountUp";
import type { SedeRotacion } from "../types";

interface CapacityCalculatorProps {
  sedes: SedeRotacion[];
}

function fmt(n: number): string {
  return n.toLocaleString("es-CO");
}

function AnimatedKPI({ value, suffix = "" }: { value: number; suffix?: string }) {
  const animated = useCountUp(value, 800, 0);
  return <>{Number(animated).toLocaleString("es-CO")}{suffix}</>;
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
      {/* Section 1: Capacidad de Compra */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/20 dark:to-transparent">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
            Capacidad de Compra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dias de cobertura objetivo
              </label>
              <span className="text-sm font-bold text-primary tabular-nums">{diasCobertura} dias</span>
            </div>
            <Slider
              value={[diasCobertura]}
              onValueChange={([v]) => setDiasCobertura(v)}
              min={30}
              max={180}
              step={15}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-0.5">
              <span>30d</span>
              <span>|</span>
              <span>90d</span>
              <span>|</span>
              <span>120d</span>
              <span>|</span>
              <span>180d</span>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20 border border-green-200/50 dark:border-green-800/30 p-5">
              <p className="text-sm text-muted-foreground">Capacidad total de reposicion</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums mt-1">
                <AnimatedKPI value={totalCapacidad} suffix=" u" />
              </p>
            </div>
            {totalSobrestock > 0 && (
              <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20 border border-red-200/50 dark:border-red-800/30 p-5">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Sobre-stock total
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums mt-1">
                  <AnimatedKPI value={totalSobrestock} suffix=" u" />
                </p>
              </div>
            )}
          </div>

          {/* Capacity vs Overstock comparison bar */}
          {totalSobrestock > 0 && totalCapacidad > 0 && (
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Capacidad: {fmt(totalCapacidad)} u</span>
                <span>Sobre-stock: {fmt(totalSobrestock)} u</span>
              </div>
              <div className="h-[12px] rounded-full overflow-hidden bg-muted flex">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${(totalCapacidad / (totalCapacidad + totalSobrestock)) * 100}%` }}
                />
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${(totalSobrestock / (totalCapacidad + totalSobrestock)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Per-sede breakdown */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sedeCapacities.map((c) => {
              const fillPct = c.stock_objetivo > 0
                ? Math.min((c.inventario / c.stock_objetivo) * 100, 100)
                : 0;
              const isOverstock = c.sobrestock > 0;

              return (
                <div
                  key={c.sede}
                  className={cn(
                    "rounded-xl border p-3 space-y-2 transition-all duration-200 hover:shadow-md",
                    isOverstock
                      ? "border-l-[3px] border-l-red-500 border-red-200 dark:border-red-800"
                      : "border-l-[3px] border-l-green-500 border-border",
                  )}
                >
                  <p className="font-medium text-sm">{c.sede.replace("Bukz ", "")}</p>
                  <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                    <span>Stock actual</span>
                    <span className="text-right font-medium text-foreground tabular-nums">
                      {fmt(c.inventario)}
                    </span>
                    <span>Stock objetivo</span>
                    <span className="text-right font-medium text-foreground tabular-nums">
                      {fmt(c.stock_objetivo)}
                    </span>
                  </div>

                  {/* Capacity gauge */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[8px] rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isOverstock ? "bg-red-500" : "bg-green-500",
                        )}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-[36px] text-right">
                      {Math.round(fillPct)}%
                    </span>
                  </div>

                  {c.capacidad_reposicion > 0 ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-semibold">
                      Capacidad: {fmt(c.capacidad_reposicion)} u
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-semibold">
                      Sobre-stock: {fmt(c.sobrestock)} u
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Tope de Novedades */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/20 dark:to-transparent">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Tope de Novedades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                % de capacidad para novedades
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={pctNovedades}
                onChange={(e) => setPctNovedades(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Numero de titulos nuevos
              </label>
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
            <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-800/30 p-4">
              <p className="text-sm text-muted-foreground">Tope novedades</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums mt-1">
                {fmt(topeNovedades)} u
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pctNovedades}% de {fmt(totalCapacidad)} u
              </p>
            </div>
            {numTitulos > 0 && (
              <>
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 p-4">
                  <p className="text-sm text-muted-foreground">Unidades por titulo</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-1">
                    {fmt(unidadesPorTitulo)} u
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {numTitulos} titulos nuevos
                  </p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 p-4">
                  <p className="text-sm text-muted-foreground">Capacidad reposicion</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                    {fmt(totalCapacidad - topeNovedades)} u
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
