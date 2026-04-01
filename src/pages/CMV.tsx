import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import UploadStep from "./cmv/components/UploadStep";
import ProcessingStep from "./cmv/components/ProcessingStep";
import { ResultsStep } from "./cmv/components/ResultsStep";
import { useCmvProcessor, useVendors, useCmvHistory } from "./cmv/hooks";
import { exportCmvToExcel } from "./cmv/excel-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

const CMV = () => {
  const {
    state,
    setSalesFile,
    setNotesFile,
    process,
    resolveVendorException,
    resolveMarginException,
    finishReview,
    reset,
    goToStep,
    userEmail,
    dataReady,
  } = useCmvProcessor();

  const { vendors, loading: vendorsLoading } = useVendors();
  const { history, loading: historyLoading, saveToHistory } = useCmvHistory();

  const handleExport = (month: number, year: number) => {
    exportCmvToExcel(state.products, month, year);
  };

  const handleSaveHistory = (month: number, year: number) => {
    saveToHistory(month, year, state.products, userEmail);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          CMV
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Costo de Mercancía Vendida
        </p>
      </div>

      <Tabs defaultValue="procesar" className="w-full">
        <TabsList>
          <TabsTrigger value="procesar">Procesar CMV</TabsTrigger>
          <TabsTrigger value="historial">
            Historial
            {!historyLoading && history.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {history.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Procesar CMV */}
        <TabsContent value="procesar" className="mt-6">
          {state.step === "upload" && (
            <UploadStep
              salesFile={state.salesFile}
              notesFile={state.notesFile}
              isProcessing={state.isProcessing}
              dataReady={dataReady}
              onSalesFileSelected={setSalesFile}
              onNotesFileSelected={setNotesFile}
              onProcess={process}
            />
          )}

          {(state.step === "processing" || state.step === "review") && (
            <ProcessingStep
              stats={state.stats}
              unknownVendorProducts={state.unknownVendorProducts}
              missingMarginProducts={state.missingMarginProducts}
              vendors={vendors}
              onResolveVendor={resolveVendorException}
              onResolveMargin={resolveMarginException}
              onFinishReview={finishReview}
              onBack={() => goToStep("upload")}
            />
          )}

          {state.step === "results" && (
            <ResultsStep
              products={state.products}
              totals={state.totals}
              onExport={handleExport}
              onSaveHistory={handleSaveHistory}
              onReset={reset}
            />
          )}
        </TabsContent>

        {/* Tab: Historial */}
        <TabsContent value="historial" className="mt-6">
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay registros en el historial. Procesa un CMV y guárdalo para verlo aquí.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial de CMV procesados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periodo</TableHead>
                      <TableHead className="text-right">Productos</TableHead>
                      <TableHead className="text-right">Total Ventas</TableHead>
                      <TableHead className="text-right">Total Costo</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                      <TableHead>Procesado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {MONTH_NAMES[record.month - 1]} {record.year}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.totalProductos.toLocaleString("es-CO")}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(record.totalVentas)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(record.totalCosto)}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.margenPromedio.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.processedBy}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CMV;
