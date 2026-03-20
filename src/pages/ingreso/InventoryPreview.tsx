import { useEffect, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface InventoryPreviewProps {
  blob: Blob;
  onDownload: () => void;
}

type Row = Record<string, unknown>;

export default function InventoryPreview({ blob, onDownload }: InventoryPreviewProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setParsing(true);
    setError(null);

    blob.arrayBuffer().then((buffer) => {
      if (cancelled) return;
      try {
        const wb = read(new Uint8Array(buffer));
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = utils.sheet_to_json<Row>(sheet, { defval: "" });
        if (json.length > 0) {
          setHeaders(Object.keys(json[0]));
        }
        setRows(json);
      } catch (e) {
        console.error("Error parsing Excel:", e);
        setError("No se pudo leer el archivo Excel");
      } finally {
        setParsing(false);
      }
    });

    return () => { cancelled = true; };
  }, [blob]);

  if (parsing) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando vista previa…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Descargar Excel
        </Button>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 px-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                !open && "-rotate-90",
              )}
            />
            Vista previa ({rows.length} {rows.length === 1 ? "producto" : "productos"})
          </Button>
        </CollapsibleTrigger>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Descargar Excel
        </Button>
      </div>

      <CollapsibleContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin resultados</p>
        ) : (
          <div className="mt-2 max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => (
                    <TableHead key={h} className="whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    {headers.map((h) => (
                      <TableCell key={h} className="whitespace-nowrap">
                        {String(row[h] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
