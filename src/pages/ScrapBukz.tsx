import { useState } from "react";
import { AlertCircle, RefreshCw, Search, Trash2, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import FileUploadZone from "./ingreso/FileUploadZone";
import IsbnValidationSummary from "./scrap/IsbnValidationSummary";
import EnrichmentProgress from "./scrap/EnrichmentProgress";
import ResultsTable from "./scrap/ResultsTable";
import {
  useScrapHealth,
  useEnrich,
  useJobStatus,
  useDownloadResult,
  useDownloadCreacion,
  useCacheStats,
  useClearCache,
} from "./scrap/hooks";
import type { EnrichResponse } from "./scrap/types";

export default function ScrapBukz() {
  const health = useScrapHealth();
  const enrichMutation = useEnrich();
  const downloadMutation = useDownloadResult();
  const creacionMutation = useDownloadCreacion();
  const cacheStats = useCacheStats();
  const clearCacheMutation = useClearCache();

  const [file, setFile] = useState<File | null>(null);
  const [delay, setDelay] = useState(0.3);
  const [enrichResult, setEnrichResult] = useState<EnrichResponse | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const jobStatus = useJobStatus(jobId);

  const handleFileSelected = (f: File) => {
    setFile(f);
    setEnrichResult(null);
    setJobId(null);
  };

  const handleEnrich = () => {
    if (!file) return;
    enrichMutation.mutate(
      { file, delay },
      {
        onSuccess: (data) => {
          setEnrichResult(data);
          setJobId(data.job_id);
        },
      },
    );
  };

  const handleReset = () => {
    setFile(null);
    setEnrichResult(null);
    setJobId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Scrap Bukz</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Enriquecimiento de metadatos de libros por ISBN
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>Caché: {cacheStats.data?.total_cached ?? 0} ISBNs</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearCacheMutation.mutate()}
            disabled={clearCacheMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {health.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : health.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexión</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            No se pudo conectar con el servidor.
            <Button variant="outline" size="sm" onClick={() => health.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Step 1: Upload */}
          {!enrichResult && (
            <>
              <FileUploadZone
                title="Sube tu archivo con ISBNs"
                hint="Arrastra un archivo CSV o Excel (.xlsx)"
                accept=".csv,.xlsx,.xls"
                fileName={file?.name}
                isLoaded={!!file}
                onFileSelected={handleFileSelected}
              />

              {file && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm whitespace-nowrap">
                        Delay entre ISBNs: {delay.toFixed(1)}s
                      </Label>
                      <Slider
                        value={[delay]}
                        onValueChange={([v]) => setDelay(v)}
                        min={0}
                        max={2}
                        step={0.1}
                        className="max-w-xs"
                      />
                    </div>
                    <Button
                      onClick={handleEnrich}
                      disabled={enrichMutation.isPending}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      {enrichMutation.isPending
                        ? "Enviando..."
                        : "Enriquecer metadatos"}
                    </Button>
                    {enrichMutation.isError && (
                      <p className="text-sm text-destructive">
                        {enrichMutation.error.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Step 2: Validation summary */}
          {enrichResult && (
            <IsbnValidationSummary
              validCount={enrichResult.valid_count}
              invalidIsbns={enrichResult.invalid_isbns}
              isbnColumn={enrichResult.isbn_column}
            />
          )}

          {/* Step 3: Progress */}
          {jobId && jobStatus.data && jobStatus.data.status === "processing" && (
            <EnrichmentProgress jobStatus={jobStatus.data} />
          )}

          {/* Step 4: Error */}
          {jobStatus.data?.status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error en el procesamiento</AlertTitle>
              <AlertDescription>{jobStatus.data.error}</AlertDescription>
            </Alert>
          )}

          {/* Step 5: Results */}
          {jobStatus.data?.status === "completed" && (
            <>
              <ResultsTable
                jobStatus={jobStatus.data}
                onDownloadExcel={() => downloadMutation.mutate(jobId!)}
                isDownloading={downloadMutation.isPending}
                onDownloadCreacion={() => creacionMutation.mutate(jobId!)}
                isDownloadingCreacion={creacionMutation.isPending}
              />
              <Button variant="outline" onClick={handleReset}>
                Procesar otro archivo
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
