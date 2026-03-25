import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnvioResultado, EnvioResumen } from "./types";

interface ResultadosTableProps {
  resultados: EnvioResultado[];
  resumen: EnvioResumen;
}

const ESTADO_STYLES: Record<
  EnvioResultado["estado"],
  { label: string; className: string }
> = {
  enviado: {
    label: "Enviado",
    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  sin_correo: {
    label: "Sin correo",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
};

export default function ResultadosTable({
  resultados,
  resumen,
}: ResultadosTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resultados del envío</CardTitle>
        <div className="flex gap-2 mt-2">
          <Badge variant="default" className="bg-green-600">
            {resumen.enviados} enviados
          </Badge>
          {resumen.errores > 0 && (
            <Badge variant="destructive">{resumen.errores} errores</Badge>
          )}
          {resumen.sin_correo > 0 && (
            <Badge variant="secondary">{resumen.sin_correo} sin correo</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded border overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Proveedor</th>
                <th className="text-left px-3 py-2">Correo</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r, i) => {
                const style = ESTADO_STYLES[r.estado];
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{r.proveedor}</td>
                    <td className="px-3 py-1.5 text-muted-foreground text-xs">
                      {r.correo || "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {r.detalle}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
