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

const SEMAFORO_COLORS = {
  verde: "#16a34a",
  amarillo: "#ca8a04",
  rojo: "#dc2626",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold">
            {typeof entry.value === "number"
              ? entry.name === "Rotacion"
                ? `${entry.value}x`
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
    rotacion: s.rotacion ?? 0,
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
          <div>
            <p className="text-sm font-medium mb-1">Inventario vs Ventas</p>
            <p className="text-xs text-muted-foreground mb-3">Unidades por sede</p>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="sede" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="inventario" name="Inventario" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rotacion con semaforo */}
          <div>
            <p className="text-sm font-medium mb-1">Rotacion por Sede</p>
            <p className="text-xs text-muted-foreground mb-3">Coloreado por estado</p>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis dataKey="sede" type="category" tick={{ fontSize: 12 }} width={100} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rotacion" name="Rotacion" radius={[0, 6, 6, 0]}>
                    {data.map((entry, i) => (
                      <Cell key={i} fill={SEMAFORO_COLORS[entry.semaforo]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
