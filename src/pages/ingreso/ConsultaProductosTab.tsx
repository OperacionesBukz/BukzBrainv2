import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useSearchByIsbn, useSearchByExcel } from "./hooks";
import { downloadBlob } from "./api";
import SearchResultsTable from "./SearchResultsTable";
import FileUploadZone from "./FileUploadZone";
import type { ProductSearchResult } from "./types";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateProductsExcelBlob(data: ProductSearchResult[]): Blob {
  const cols = ["ISBN", "ID", "Variant ID", "Titulo", "Vendor", "Precio", "Categoria", "Cantidad"];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Arial" ss:Size="10"/><Interior ss:Color="#2C3E50" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
 <Style ss:ID="norm"><Font ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="right"><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Horizontal="Right"/></Style>
</Styles>
<Worksheet ss:Name="Productos">
<Table>
 ${cols.map(() => `<Column ss:Width="130"/>`).join("")}
 <Row>${cols.map((c) => `<Cell ss:StyleID="head"><Data ss:Type="String">${esc(c)}</Data></Cell>`).join("")}</Row>`;

  data.forEach((row) => {
    xml += `
 <Row>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(row.ISBN)}</Data></Cell>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(String(row.ID ?? ""))}</Data></Cell>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(String(row["Variant ID"] ?? ""))}</Data></Cell>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(row.Titulo)}</Data></Cell>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(row.Vendor)}</Data></Cell>
  <Cell ss:StyleID="right"><Data ss:Type="${row.Precio != null ? "Number" : "String"}">${row.Precio != null ? row.Precio : ""}</Data></Cell>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(row.Categoria ?? "")}</Data></Cell>
  <Cell ss:StyleID="right"><Data ss:Type="${row.Cantidad != null ? "Number" : "String"}">${row.Cantidad != null ? row.Cantidad : ""}</Data></Cell>
 </Row>`;
  });

  xml += `
</Table>
</Worksheet>
</Workbook>`;

  return new Blob([xml], {
    type: "application/vnd.ms-excel",
  });
}

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

  const handleDownloadIndividual = () => {
    if (individualResults.length === 0) return;
    const blob = generateProductsExcelBlob(individualResults);
    downloadBlob(blob, "Producto_Shopify.xls");
  };

  // -- bulk search --
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkBlob, setBulkBlob] = useState<Blob | null>(null);
  const bulkMutation = useSearchByExcel();

  const handleBulkSearch = async () => {
    if (!bulkFile) return;
    setBulkBlob(null);
    try {
      const blob = await bulkMutation.mutateAsync(bulkFile);
      setBulkBlob(blob);
      toast.success("Resultados listos para descargar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
    }
  };

  const handleDownloadBulk = () => {
    if (!bulkBlob) return;
    downloadBlob(bulkBlob, "Productos_Shopify.xlsx");
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

          <SearchResultsTable
            data={individualResults}
            onDownload={individualResults.length > 0 ? handleDownloadIndividual : undefined}
          />
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
            onFileSelected={(file) => {
              setBulkFile(file);
              setBulkBlob(null);
            }}
          />

          {bulkMutation.isPending && <Progress className="animate-pulse" />}

          <div className="flex gap-2">
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

            {bulkBlob && (
              <Button variant="outline" onClick={handleDownloadBulk}>
                Descargar Excel
              </Button>
            )}
          </div>

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
