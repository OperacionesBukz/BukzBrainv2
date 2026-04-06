import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
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
            <p className="text-sm text-muted-foreground mb-2">Inventario vs Ventas (unidades)</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data}>
                <XAxis dataKey="sede" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => v.toLocaleString("es-CO")} />
                <Legend />
                <Bar dataKey="inventario" name="Inventario" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rotacion con colores de semáforo */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Rotacion por Sede</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="sede" type="category" tick={{ fontSize: 12 }} width={120} />
                <Tooltip formatter={(v: number) => `${v}x`} />
                <Bar dataKey="rotacion" name="Rotacion" radius={[0, 4, 4, 0]}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={SEMAFORO_COLORS[entry.semaforo]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
