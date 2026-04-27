import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Download,
  Plus,
  Loader2,
  Save,
  Undo2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useInlineEditing } from "./useInlineEditing";
import EditableCell from "./EditableCell";
import type { ProductSearchResult } from "./types";

interface SearchResultsTableProps {
  data: ProductSearchResult[];
  onDownload?: () => void;
}

export default function SearchResultsTable({
  data,
  onDownload,
}: SearchResultsTableProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  // Local copy of data so we can reflect applied changes
  const [localData, setLocalData] = useState<ProductSearchResult[]>(data);
  const prevDataRef = useRef(data);
  useEffect(() => {
    if (data !== prevDataRef.current) {
      setLocalData(data);
      prevDataRef.current = data;
    }
  }, [data]);

  const editing = useInlineEditing({
    onApplied: (results) => {
      setLocalData((prev) =>
        prev.map((row) => {
          const result = results.find((r) => r.sku === row.ISBN);
          if (!result?.success) return row;
          const appliedChanges = editing.changes[row.ISBN];
          if (!appliedChanges) return row;
          const updated = { ...row };
          if (appliedChanges.Vendor) updated.Vendor = appliedChanges.Vendor;
          if (appliedChanges.Precio) updated.Precio = appliedChanges.Precio;
          if (appliedChanges.Categoria) updated.Categoria = appliedChanges.Categoria;
          return updated;
        }),
      );
    },
  });

  if (localData.length === 0) return null;

  const getOriginal = (row: ProductSearchResult, field: string): string => {
    const val = (row as Record<string, unknown>)[field];
    return val != null ? String(val) : "";
  };

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
            Vista previa ({localData.length}{" "}
            {localData.length === 1 ? "producto" : "productos"})
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
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
          )}
        </div>
      </div>

      <CollapsibleContent>
        <ScrollArea className="mt-2 w-full whitespace-nowrap rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">ISBN</TableHead>
                <TableHead className="min-w-[100px]">ID</TableHead>
                <TableHead className="min-w-[110px]">Variant ID</TableHead>
                <TableHead className="min-w-[250px]">Título</TableHead>
                <TableHead className="min-w-[160px]">Vendor</TableHead>
                <TableHead className="min-w-[110px] text-right">
                  Precio
                </TableHead>
                <TableHead className="min-w-[160px]">Categoría</TableHead>
                <TableHead className="min-w-[90px] text-right">
                  Cantidad
                </TableHead>
                <TableHead className="min-w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localData.map((row, i) => {
                const found = row.Titulo !== "No encontrado";
                const result = editing.rowResults[row.ISBN];
                return (
                  <TableRow
                    key={`${row.ISBN}-${i}`}
                    className={cn(
                      result?.success === true &&
                        "bg-green-50 dark:bg-green-950/20",
                      result?.success === false &&
                        "bg-red-50 dark:bg-red-950/20",
                    )}
                  >
                    <TableCell className="font-mono text-sm">
                      {row.ISBN}
                    </TableCell>
                    <TableCell>{found ? row.ID : "—"}</TableCell>
                    <TableCell>{found ? row["Variant ID"] : "—"}</TableCell>
                    <TableCell>
                      {found ? (
                        row.Titulo
                      ) : (
                        <Badge variant="destructive">No encontrado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={editing.getDisplayValue(
                          row.ISBN,
                          "Vendor",
                          getOriginal(row, "Vendor"),
                        )}
                        onChange={(v) =>
                          editing.updateField(
                            row.ISBN,
                            "Vendor",
                            v,
                            getOriginal(row, "Vendor"),
                          )
                        }
                        isModified={editing.isFieldModified(row.ISBN, "Vendor")}
                        disabled={!found}
                        bold
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableCell
                        value={editing.getDisplayValue(
                          row.ISBN,
                          "Precio",
                          getOriginal(row, "Precio"),
                        )}
                        onChange={(v) =>
                          editing.updateField(
                            row.ISBN,
                            "Precio",
                            v,
                            getOriginal(row, "Precio"),
                          )
                        }
                        isModified={editing.isFieldModified(
                          row.ISBN,
                          "Precio",
                        )}
                        type="number"
                        align="right"
                        disabled={!found}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={editing.getDisplayValue(
                          row.ISBN,
                          "Categoria",
                          getOriginal(row, "Categoria"),
                        )}
                        onChange={(v) =>
                          editing.updateField(
                            row.ISBN,
                            "Categoria",
                            v,
                            getOriginal(row, "Categoria"),
                          )
                        }
                        isModified={editing.isFieldModified(
                          row.ISBN,
                          "Categoria",
                        )}
                        disabled={!found}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {row.Cantidad != null ? row.Cantidad : "—"}
                    </TableCell>
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
                      ) : !found ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => navigate("/crear-productos")}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Crear
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
