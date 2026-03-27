import { useState } from "react";
import { Check, ChevronsUpDown, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { JobStatus } from "./types";

interface ResultsTableProps {
  jobStatus: JobStatus;
  onDownloadExcel: () => void;
  isDownloading: boolean;
  onDownloadCreacion: (vendor?: string) => void;
  isDownloadingCreacion: boolean;
  vendors: string[];
}

export default function ResultsTable({
  jobStatus,
  onDownloadExcel,
  isDownloading,
  onDownloadCreacion,
  isDownloadingCreacion,
  vendors,
}: ResultsTableProps) {
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");

  const logs = jobStatus.logs;
  const completos = logs.filter((l) => l.startsWith("ok|")).length;
  const parciales = logs.filter((l) => l.startsWith("parcial|")).length;
  const noEncontrados = logs.filter((l) => l.startsWith("no|")).length;

  const displayLogs = showIncomplete
    ? logs.filter((l) => !l.startsWith("ok|"))
    : logs;

  const handleCreacionClick = () => {
    setSelectedVendor("");
    setDialogOpen(true);
  };

  const handleConfirmDownload = () => {
    setDialogOpen(false);
    onDownloadCreacion(selectedVendor || undefined);
  };

  return (
    <>
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
            <Button
              variant="secondary"
              onClick={handleCreacionClick}
              disabled={isDownloadingCreacion}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {isDownloadingCreacion ? "Descargando..." : "Descargar para Creacion"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Vendor</DialogTitle>
            <DialogDescription>
              Elige el vendor para todas las filas del archivo. Puedes dejarlo vacío para llenarlo después.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between"
                >
                  {selectedVendor || "Sin vendor (vacío)"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar vendor..." />
                  <CommandList>
                    <CommandEmpty>No se encontró vendor.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setSelectedVendor("");
                          setPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !selectedVendor ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Sin vendor (vacío)
                      </CommandItem>
                      {vendors.map((v) => (
                        <CommandItem
                          key={v}
                          value={v}
                          onSelect={() => {
                            setSelectedVendor(v);
                            setPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedVendor === v ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {v}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDownload}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
