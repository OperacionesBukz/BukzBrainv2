import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useSearchByIsbn, useSearchByExcel } from "./hooks";
import SearchResultsTable from "./SearchResultsTable";
import FileUploadZone from "./FileUploadZone";
import type { ProductSearchResult } from "./types";

export default function ConsultaProductosTab() {
  // -- individual search --
  const [inputIsbn, setInputIsbn] = useState("");
  const [searchIsbn, setSearchIsbn] = useState("");
  const searchQuery = useSearchByIsbn(searchIsbn);

  const handleSearch = () => {
    const isbn = inputIsbn.trim();
    if (!isbn) return;
    setSearchIsbn(isbn);
  };

  const individualResults: ProductSearchResult[] = searchQuery.data
    ? [searchQuery.data.product]
    : [];

  // -- bulk search --
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const bulkMutation = useSearchByExcel();

  const handleBulkSearch = async () => {
    if (!bulkFile) return;
    try {
      await bulkMutation.mutateAsync(bulkFile);
      toast.success("Archivo descargado con los resultados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
    }
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Individual search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Búsqueda Individual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ingresa ISBN o SKU"
              value={inputIsbn}
              onChange={(e) => setInputIsbn(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-sm"
            />
            <Button
              onClick={handleSearch}
              disabled={!inputIsbn.trim() || searchQuery.isFetching}
            >
              {searchQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>

          {searchQuery.isError && (
            <p className="text-sm text-destructive">
              {searchQuery.error instanceof Error
                ? searchQuery.error.message
                : "Error en la búsqueda"}
            </p>
          )}

          <SearchResultsTable data={individualResults} />
        </CardContent>
      </Card>

      <Separator />

      {/* Bulk search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Búsqueda Masiva por Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadZone
            title="Subir archivo Excel"
            hint="Arrastra o haz clic — columnas: ISBN (y opcionalmente Cantidad)"
            isLoaded={bulkFile !== null}
            fileName={bulkFile?.name}
            onFileSelected={setBulkFile}
          />

          {bulkMutation.isPending && <Progress className="animate-pulse" />}

          <Button
            onClick={handleBulkSearch}
            disabled={!bulkFile || bulkMutation.isPending}
          >
            {bulkMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Consultar Información
          </Button>

          {bulkMutation.isError && (
            <p className="text-sm text-destructive">
              {bulkMutation.error instanceof Error
                ? bulkMutation.error.message
                : "Error al procesar el archivo"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
