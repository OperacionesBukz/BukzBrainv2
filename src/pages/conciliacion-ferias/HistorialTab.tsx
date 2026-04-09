import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useConciliacionLog } from "./hooks";

function formatDate(
  ts: { seconds: number } | null | undefined,
): string {
  if (!ts) return "\u2014";
  return new Date(ts.seconds * 1000).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistorialTab() {
  const { logs, loading } = useConciliacionLog();

  if (loading) {
    return <LoadingState />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Historial de conciliaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState compact icon={FileText} title="No hay conciliaciones registradas aún" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Feria</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Enviado</TableHead>
                  <TableHead className="text-right">
                    Devuelto
                  </TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">
                    Diferencia
                  </TableHead>
                  <TableHead>Realizado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(
                        log.creadoEn as {
                          seconds: number;
                        } | null,
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.feriaLocation}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.fechaInicio} a {log.fechaFin}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.totalEnviado}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.totalDevuelto}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.totalVendido}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          log.totalDiferencia > 0
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                        )}
                      >
                        {log.totalDiferencia}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.realizadoPorNombre}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
