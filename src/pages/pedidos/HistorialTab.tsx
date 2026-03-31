import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePedidosLog } from "./hooks";

function formatDate(ts: { seconds?: number } | null | undefined): string {
  if (!ts?.seconds) return "\u2014";
  return new Date(ts.seconds * 1000).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistorialTab() {
  const { logs, loading } = usePedidosLog();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando historial...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay pedidos registrados aún.
      </p>
    );
  }

  return (
    <div className="overflow-auto max-h-[500px] border rounded-md">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Estado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Mes / Año</TableHead>
            <TableHead>Enviado por</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {log.estado === "enviado" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
              </TableCell>
              <TableCell>
                <Badge variant={log.tipo === "sede" ? "default" : "secondary"}>
                  {log.tipo === "sede" ? "Sede" : "Ciudad"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{log.proveedor}</TableCell>
              <TableCell>{log.destino}</TableCell>
              <TableCell>{log.tipoPedido}</TableCell>
              <TableCell>
                {log.mes} {log.anio}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {log.enviadoPorNombre}
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatDate(log.creadoEn as { seconds?: number } | null)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
