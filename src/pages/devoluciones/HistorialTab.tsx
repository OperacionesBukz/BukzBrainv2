import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download, Send } from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { utils, writeFile } from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDevolucionesLog } from "./hooks";
import type { DevolucionItem } from "./types";

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

export default function HistorialTab({ highlightCodigo }: { highlightCodigo?: string }) {
  const { logs, loading } = useDevolucionesLog();
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightCodigo || loading || logs.length === 0) return;
    const match = logs.find((l) => l.codigoDevolucion === highlightCodigo);
    if (match) setExpandedId(match.id);
  }, [highlightCodigo, loading, logs]);

  const filtered = logs.filter((log) => {
    if (filtroTipo !== "todos" && log.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todos" && log.estado !== filtroEstado) return false;
    return true;
  });

  if (loading) {
    return <LoadingState />;
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
          <EmptyState compact icon={Send} title="No hay registros de envío" />
        ) : (
          <div className="rounded border overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="w-8 px-2 py-2" />
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
                  const logItems = log.items as DevolucionItem[] | undefined;
                  const isExpanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
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
                      {isExpanded && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={8} className="px-3 py-2 bg-muted/30">
                            {logItems && logItems.length > 0 ? (
                              <>
                                <div className="rounded border overflow-auto max-h-[300px]">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/50 sticky top-0">
                                      <tr>
                                        <th className="text-left px-2 py-1">#</th>
                                        <th className="text-left px-2 py-1">ISBN</th>
                                        <th className="text-left px-2 py-1">Título</th>
                                        <th className="text-right px-2 py-1">Cantidad</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {logItems.map((item) => (
                                        <tr key={item.fila} className="border-t">
                                          <td className="px-2 py-1">{item.fila}</td>
                                          <td className="px-2 py-1 font-mono">{item.isbn ?? "—"}</td>
                                          <td className="px-2 py-1">{item.titulo ?? "—"}</td>
                                          <td className="px-2 py-1 text-right">{item.cantidad}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs text-muted-foreground">
                                    {logItems.length} item(s) · Total: {logItems.reduce((s, i) => s + i.cantidad, 0)} unidades
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rows = logItems.map((i) => ({
                                        "#": i.fila,
                                        ISBN: i.isbn ?? "",
                                        Título: i.titulo ?? "",
                                        Cantidad: i.cantidad,
                                        ...(i.extras ?? {}),
                                      }));
                                      const wb = utils.book_new();
                                      utils.book_append_sheet(wb, utils.json_to_sheet(rows), "Items");
                                      const name = `devolucion_${log.destinatario.replace(/\s+/g, "_")}${log.codigoDevolucion ? `_${log.codigoDevolucion}` : ""}.xlsx`;
                                      writeFile(wb, name);
                                    }}
                                  >
                                    <Download className="h-3 w-3" />
                                    Descargar Excel
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">Sin detalle de items</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
