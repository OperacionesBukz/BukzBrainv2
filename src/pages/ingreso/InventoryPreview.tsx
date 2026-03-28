import { useEffect, useState } from "react";
import {
  ChevronDown,
  Download,
  Loader2,
  Save,
  Undo2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { read, utils } from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useInlineEditing } from "./useInlineEditing";
import EditableCell from "./EditableCell";

interface InventoryPreviewProps {
  blob: Blob;
  onDownload: () => void;
}

type Row = Record<string, unknown>;

const EDITABLE_FIELDS = ["Vendor", "Precio", "Categoria"];

export default function InventoryPreview({
  blob,
  onDownload,
}: InventoryPreviewProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const editing = useInlineEditing({
    onApplied: (results) => {
      setRows((prev) =>
        prev.map((row) => {
          const isbn = getIsbn(row);
          const result = results.find((r) => r.sku === isbn);
          if (!result?.success) return row;
          const appliedChanges = editing.changes[isbn];
          if (!appliedChanges) return row;
          const updated = { ...row };
          for (const [field, value] of Object.entries(appliedChanges)) {
            updated[field] = value;
          }
          return updated;
        }),
      );
    },
  });

  useEffect(() => {
    let cancelled = false;
    setParsing(true);
    setError(null);
    editing.reset();

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

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  const getIsbn = (row: Row): string =>
    String(row["ISBN"] ?? row["isbn"] ?? "");

  const isFound = (row: Row): boolean => {
    const titulo = String(row["Titulo"] ?? row["titulo"] ?? "");
    return titulo !== "" && titulo !== "No encontrado";
  };

  const isEditable = (header: string): boolean =>
    EDITABLE_FIELDS.includes(header);

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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 px-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                !open && "-rotate-90",
              )}
            />
            Vista previa ({rows.length}{" "}
            {rows.length === 1 ? "producto" : "productos"})
          </Button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 flex-wrap">
          {editing.totalChanges > 0 && (
            <>
              <Badge
                variant="outline"
                className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
              >
                {editing.totalChanges} cambio
                {editing.totalChanges !== 1 && "s"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={editing.handleDiscard}
                disabled={editing.isPending}
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={editing.handleApply}
                disabled={editing.isPending}
              >
                {editing.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Aplicar en Shopify
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Descargar Excel
          </Button>
        </div>
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
                  <TableHead className="min-w-[70px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => {
                  const isbn = getIsbn(row);
                  const found = isFound(row);
                  const result = isbn
                    ? editing.rowResults[isbn]
                    : undefined;
                  return (
                    <TableRow
                      key={i}
                      className={cn(
                        result?.success === true &&
                          "bg-green-50 dark:bg-green-950/20",
                        result?.success === false &&
                          "bg-red-50 dark:bg-red-950/20",
                      )}
                    >
                      {headers.map((h) => {
                        const originalValue = String(row[h] ?? "");
                        if (found && isbn && isEditable(h)) {
                          return (
                            <TableCell key={h} className="whitespace-nowrap">
                              <EditableCell
                                value={editing.getDisplayValue(
                                  isbn,
                                  h,
                                  originalValue,
                                )}
                                onChange={(v) =>
                                  editing.updateField(
                                    isbn,
                                    h,
                                    v,
                                    originalValue,
                                  )
                                }
                                isModified={editing.isFieldModified(isbn, h)}
                                type={h === "Precio" ? "number" : "text"}
                                align={h === "Precio" ? "right" : "left"}
                              />
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={h} className="whitespace-nowrap">
                            {h === "Titulo" &&
                            originalValue === "No encontrado" ? (
                              <Badge variant="destructive">
                                No encontrado
                              </Badge>
                            ) : (
                              originalValue
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        {result ? (
                          result.success ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Listo
                            </span>
                          ) : (
                            <span
                              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"
                              title={result.error}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Error
                            </span>
                          )
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
