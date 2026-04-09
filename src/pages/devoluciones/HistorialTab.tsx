import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDevolucionesLog } from "./hooks";

const TIPO_STYLES = {
  sede: { label: "Sede", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  proveedor: { label: "Proveedor", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

const ESTADO_STYLES = {
  enviado: { label: "Enviado", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  error: { label: "Error", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistorialTab() {
  const { logs, loading } = useDevolucionesLog();
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const filtered = logs.filter((log) => {
    if (filtroTipo !== "todos" && log.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todos" && log.estado !== filtroEstado) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Historial de envíos</CardTitle>
          <div className="flex gap-2">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="sede">Sedes</SelectItem>
                <SelectItem value="proveedor">Proveedores</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="enviado">Enviados</SelectItem>
                <SelectItem value="error">Errores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay registros de envío
          </p>
        ) : (
          <div className="rounded border overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Destinatario</th>
                  <th className="text-left px-3 py-2">Motivo</th>
                  <th className="text-left px-3 py-2">Código</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Enviado por</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const tipoStyle = TIPO_STYLES[log.tipo];
                  const estadoStyle = ESTADO_STYLES[log.estado];
                  return (
                    <tr key={log.id} className="border-t">
                      <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.creadoEn as { seconds: number } | null)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant="secondary" className={tipoStyle.className}>
                          {tipoStyle.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 font-medium">{log.destinatario}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{log.motivo}</td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs">
                        {log.codigoDevolucion ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant="secondary" className={estadoStyle.className}>
                          {estadoStyle.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {log.enviadoPorNombre}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
