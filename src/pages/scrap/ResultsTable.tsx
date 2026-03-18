import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { JobStatus } from "./types";

interface ResultsTableProps {
  jobStatus: JobStatus;
  onDownloadExcel: () => void;
  isDownloading: boolean;
}

export default function ResultsTable({
  jobStatus,
  onDownloadExcel,
  isDownloading,
}: ResultsTableProps) {
  const [showIncomplete, setShowIncomplete] = useState(false);

  const logs = jobStatus.logs;
  const completos = logs.filter((l) => l.startsWith("ok|")).length;
  const parciales = logs.filter((l) => l.startsWith("parcial|")).length;
  const noEncontrados = logs.filter((l) => l.startsWith("no|")).length;

  const displayLogs = showIncomplete
    ? logs.filter((l) => !l.startsWith("ok|"))
    : logs;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Resultados</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-incomplete"
                checked={showIncomplete}
                onCheckedChange={setShowIncomplete}
              />
              <Label htmlFor="show-incomplete" className="text-sm">
                Solo incompletos
              </Label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="default">{completos} completos</Badge>
          <Badge variant="secondary">{parciales} parciales</Badge>
          <Badge variant="destructive">{noEncontrados} no encontrados</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border overflow-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2">ISBN</th>
                <th className="text-left px-3 py-2">Fuente</th>
                <th className="text-left px-3 py-2">Campos</th>
              </tr>
            </thead>
            <tbody>
              {displayLogs.map((log, i) => {
                const [type, isbn, source, campos] = log.split("|");
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">
                      {type === "ok" && <span className="text-green-500">Completo</span>}
                      {type === "parcial" && <span className="text-yellow-500">Parcial</span>}
                      {type === "no" && <span className="text-red-500">No encontrado</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{isbn}</td>
                    <td className="px-3 py-1.5">{source || "—"}</td>
                    <td className="px-3 py-1.5">{campos || "0/10"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <Button onClick={onDownloadExcel} disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? "Descargando..." : "Descargar Excel enriquecido"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
