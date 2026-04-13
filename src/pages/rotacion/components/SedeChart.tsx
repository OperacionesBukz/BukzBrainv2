import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SedeRotacion } from "../types";

interface SedeChartProps {
  sedes: SedeRotacion[];
}

const SEMAFORO_GRADIENT = {
  verde: { from: "#4ade80", to: "#16a34a" },
  amarillo: { from: "#facc15", to: "#ca8a04" },
  rojo: { from: "#f87171", to: "#dc2626" },
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-md p-3 shadow-xl"
      style={{ borderLeft: `3px solid ${payload[0]?.color ?? "hsl(var(--primary))"}` }}
    >
      <p className="text-sm font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold">
            {typeof entry.value === "number"
              ? entry.name === "Rotacion"
                ? `${Math.round(entry.value)}%`
                : entry.value.toLocaleString("es-CO")
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SedeChart({ sedes }: SedeChartProps) {
  const data = sedes.map((s) => ({
    sede: s.sede.replace("Bukz ", ""),
    inventario: s.inventario_unidades,
    ventas: s.vendidas_unidades,
    rotacion: s.rotacion != null ? Math.round(s.rotacion * 100) : 0,
    semaforo: s.semaforo,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Comparacion por Sede</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Inventario vs Ventas */}
          <div className="relative overflow-hidden rounded-xl bg-muted/20 dark:bg-muted/10 p-4">
            <div className="absolute inset-0 bg-grid-pattern opacity-20 dark:opacity-10" />
            <div className="relative">
              <p className="text-base font-semibold mb-0.5">Inventario vs Ventas</p>
              <p className="text-xs text-muted-foreground mb-3">Unidades por sede</p>
              <div className="h-[200px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <defs>
                      <linearGradient id="gradInventario" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" className="stroke-border" vertical={false} opacity={0.5} />
                    <XAxis dataKey="sede" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inventario" name="Inventario" fill="url(#gradInventario)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="ventas" name="Ventas" fill="url(#gradVentas)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Rotacion con semaforo */}
          <div className="relative overflow-hidden rounded-xl bg-muted/20 dark:bg-muted/10 p-4">
            <div className="absolute inset-0 bg-grid-pattern opacity-20 dark:opacity-10" />
            <div className="relative">
              <p className="text-base font-semibold mb-0.5">Rotacion por Sede</p>
              <p className="text-xs text-muted-foreground mb-3">% del inventario vendido</p>
              <div className="h-[200px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical">
                    <defs>
                      {Object.entries(SEMAFORO_GRADIENT).map(([key, { from, to }]) => (
                        <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={from} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={to} stopOpacity={0.8} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" className="stroke-border" horizontal={false} opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis dataKey="sede" type="category" tick={{ fontSize: 12 }} width={100} className="text-muted-foreground" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rotacion" name="Rotacion" radius={[0, 6, 6, 0]}>
                      {data.map((entry, i) => (
                        <Cell key={i} fill={`url(#grad-${entry.semaforo})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
