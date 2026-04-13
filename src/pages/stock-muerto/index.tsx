import {
  Skull,
  RotateCcw,
  AlertCircle,
  Clock,
  Download,
  Search,
  Loader2,
  CheckCircle2,
  Package,
  PackageX,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
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
import { useVendors } from "@/pages/reposiciones/hooks";
import { useDeadStockFlow } from "./hooks";
import { downloadExcelFromBase64 } from "./api";
import type { DeadStockResult } from "./types";

// -- Processing steps config --
const STEPS = [
  { key: "products", label: "Obteniendo productos", detail: "Consultando inventario del proveedor en Shopify" },
  { key: "sales", label: "Obteniendo ventas", detail: "Consultando ordenes pagadas en el periodo" },
  { key: "processing", label: "Analizando datos", detail: "Cruzando inventario con ventas y generando Excel" },
];

// -- Main page --
export default function StockMuerto() {
  const flow = useDeadStockFlow();
  const isDone = flow.phase === "done" && flow.result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={isDone
        ? "relative -mx-4 -mt-2 px-4 pt-4 pb-6 rounded-b-2xl overflow-hidden"
        : ""
      }>
        {isDone && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent dark:from-primary/10" />
            <div className="absolute inset-0 bg-dot-pattern opacity-30 dark:opacity-15" />
          </>
        )}

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-primary/10">
              <Skull className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tighter">Stock Muerto</h1>
              <p className="text-sm text-muted-foreground">
                Productos sin ventas por proveedor
              </p>
              <div className="h-[3px] w-12 bg-primary rounded-full mt-1.5" />

              {isDone && flow.result && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono bg-muted/80 dark:bg-muted/50 px-2.5 py-1 rounded-md text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(flow.result.fecha_calculo).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono bg-primary/10 px-2.5 py-1 rounded-md text-primary font-semibold">
                    {flow.result.vendor}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono bg-destructive/10 px-2.5 py-1 rounded-md text-destructive font-semibold">
                    <CalendarDays className="h-3 w-3" />
                    {flow.result.days_without_sales}d sin ventas
                  </span>
                </div>
              )}
            </div>
          </div>
          {isDone && (
            <Button variant="outline" size="sm" className="press-effect" onClick={flow.reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Nuevo analisis
            </Button>
          )}
        </div>
      </div>

      {/* Config */}
      {(flow.phase === "idle" || flow.phase === "error") && (
        <div className="animate-fade-in-scale">
          <ConfigSection
            onStart={(vendor, days, months) =>
              flow.startAnalysis({ vendor, days_without_sales: days, min_product_age_months: months })
            }
            disabled={flow.phase === "processing" as never}
          />
          {flow.error && (
            <Alert variant="destructive" className="mt-4 max-w-[640px] mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{flow.error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Processing */}
      {flow.phase === "processing" && (
        <div className="animate-fade-in-scale">
          <ProcessingProgress
            backendPhase={flow.backendPhase}
            elapsedSeconds={flow.elapsedSeconds}
          />
        </div>
      )}

      {/* Results */}
      {isDone && flow.result && (
        <div className="space-y-6">
          <div className="animate-fade-in opacity-0" style={{ animationDelay: "0ms" }}>
            <ResultsSummary result={flow.result} />
          </div>
          {flow.result.excel_base64 && (
            <div className="animate-fade-in opacity-0" style={{ animationDelay: "120ms" }}>
              <DownloadSection result={flow.result} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// -- Config Section --
function ConfigSection({
  onStart,
  disabled,
}: {
  onStart: (vendor: string, days: number, months: number) => void;
  disabled: boolean;
}) {
  const { data: vendors = [], isLoading: vendorsLoading } = useVendors();
  const [vendor, setVendor] = useState("");
  const [days, setDays] = useState("90");
  const [months, setMonths] = useState("2");
  const [vendorOpen, setVendorOpen] = useState(false);

  const isReady = !!vendor && !disabled && !vendorsLoading;

  return (
    <div className="relative max-w-[640px] mx-auto overflow-hidden rounded-2xl border border-border/50 bg-card">
      <div className="absolute inset-0 bg-dot-pattern opacity-30 dark:opacity-15" />

      <div className="relative pt-8 pb-8 px-6 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-[80px] h-[80px] flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="w-[56px] h-[56px] rounded-full bg-primary/15 flex items-center justify-center">
              <Search className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold mt-4">Configurar Analisis</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-[400px]">
            Selecciona un proveedor y los filtros para identificar productos sin ventas
          </p>
        </div>

        <div className="grid gap-4 mt-6">
          {/* Vendor selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Proveedor
            </label>
            <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={vendorOpen}
                  disabled={vendorsLoading}
                  className="w-full justify-between font-normal dark:bg-background dark:border-input"
                >
                  <span className="truncate">
                    {vendorsLoading
                      ? "Cargando proveedores..."
                      : vendor || "Seleccionar proveedor..."}
                  </span>
                  {vendorsLoading ? (
                    <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0 dark:bg-popover dark:border-border" align="start">
                <Command>
                  <CommandInput placeholder="Buscar proveedor..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                    {vendors.map((v) => (
                      <CommandItem
                        key={v.name}
                        value={v.name}
                        onSelect={() => {
                          setVendor(v.name);
                          setVendorOpen(false);
                        }}
                        className="cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900 dark:data-[selected=true]:bg-blue-950/40 dark:data-[selected=true]:text-blue-100"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className={cn("flex-1 truncate", vendor === v.name && "font-semibold")}>
                            {v.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {v.product_count} prod.
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Days without sales */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dias sin ventas
            </label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="180">180 dias</SelectItem>
                <SelectItem value="365">365 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min product age */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Edad minima del producto
            </label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mes (excluir creados hace menos de 1 mes)</SelectItem>
                <SelectItem value="2">2 meses (excluir creados hace menos de 2 meses)</SelectItem>
                <SelectItem value="3">3 meses (excluir creados hace menos de 3 meses)</SelectItem>
                <SelectItem value="6">6 meses (excluir creados hace menos de 6 meses)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          className={cn(
            "group relative w-full h-[48px] text-base font-semibold mt-6 press-effect overflow-hidden transition-shadow duration-300",
            isReady && "shadow-[0_0_20px_hsl(var(--primary)/0.3)]",
          )}
          disabled={!isReady}
          onClick={() => onStart(vendor, Number(days), Number(months))}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <span className="relative flex items-center justify-center">
            <Search className="mr-2 h-5 w-5" />
            Analizar Stock Muerto
          </span>
        </Button>
      </div>
    </div>
  );
}


// -- Processing Progress --
function ProcessingProgress({
  backendPhase,
  elapsedSeconds,
}: {
  backendPhase: string | null;
  elapsedSeconds: number;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === backendPhase);
  const progressPct = currentIdx === -1 ? 10 : Math.round(((currentIdx + 0.5) / STEPS.length) * 100);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
  };

  return (
    <div className="relative max-w-[480px] mx-auto overflow-hidden rounded-2xl border border-border/50 bg-card">
      <div className="absolute inset-0 bg-dot-pattern opacity-20 dark:opacity-10" />

      <div className="relative py-8 px-6">
        {/* Orbital visualization */}
        <div className="relative w-[120px] h-[120px] mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
          <div
            className="absolute w-3 h-3 rounded-full bg-primary animate-orbit"
            style={{ top: "50%", left: "50%", marginTop: "-6px", marginLeft: "-6px" }}
          />
          <div
            className="absolute w-2 h-2 rounded-full bg-primary/50 animate-orbit-reverse"
            style={{ top: "50%", left: "50%", marginTop: "-4px", marginLeft: "-4px" }}
          />
          <div className="absolute inset-[20px] rounded-full border-2 border-primary/30 bg-card/80 backdrop-blur-sm flex items-center justify-center">
            <span className="text-2xl font-bold font-mono text-primary">{progressPct}%</span>
          </div>
        </div>

        {/* Steps timeline */}
        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            const isLast = i === STEPS.length - 1;

            return (
              <div key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {isDone ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-muted shrink-0" />
                  )}
                  {!isLast && (
                    <div className={cn(
                      "w-[2px] h-[28px]",
                      isDone ? "bg-green-600 dark:bg-green-400" : "bg-muted",
                    )} />
                  )}
                </div>

                <div className={cn(
                  "pb-5 -mt-0.5 px-3 py-2 rounded-lg transition-colors",
                  isActive && "bg-primary/5 dark:bg-primary/10",
                )}>
                  <p className={cn(
                    "text-sm font-medium",
                    isDone && "text-green-600 dark:text-green-400",
                    isActive && "text-foreground font-semibold",
                    !isDone && !isActive && "text-muted-foreground",
                  )}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timer */}
        <div className="text-center border-t border-border/50 pt-4 mt-2">
          <p className="text-2xl font-mono font-bold tracking-wider text-primary">
            {formatTime(elapsedSeconds)}
          </p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">
            Tiempo transcurrido
          </p>
        </div>
      </div>
    </div>
  );
}


// -- Results Summary --
function ResultsSummary({ result }: { result: DeadStockResult }) {
  const cards = [
    {
      label: "Variantes con stock",
      value: result.total_variants_with_stock.toLocaleString("es-CO"),
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Stock muerto",
      value: result.dead_stock_variants.toLocaleString("es-CO"),
      icon: PackageX,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
    {
      label: "Unidades muertas",
      value: result.dead_stock_units.toLocaleString("es-CO"),
      icon: Skull,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      label: "% Stock muerto",
      value: `${result.dead_stock_pct}%`,
      icon: BarChart3,
      color: result.dead_stock_pct > 50
        ? "text-red-600 dark:text-red-400"
        : result.dead_stock_pct > 25
          ? "text-orange-600 dark:text-orange-400"
          : "text-green-600 dark:text-green-400",
      bg: result.dead_stock_pct > 50
        ? "bg-red-100 dark:bg-red-900/30"
        : result.dead_stock_pct > 25
          ? "bg-orange-100 dark:bg-orange-900/30"
          : "bg-green-100 dark:bg-green-900/30",
    },
  ];

  return (
    <div className="max-w-[800px] mx-auto">
      {result.message && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/50 bg-card p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", card.bg)}>
                <card.icon className={cn("h-4 w-4", card.color)} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
            </div>
            <p className={cn("text-2xl font-bold font-mono", card.color)}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


// -- Download Section --
function DownloadSection({ result }: { result: DeadStockResult }) {
  const handleDownload = () => {
    if (!result.excel_base64) return;
    const date = new Date().toISOString().slice(0, 10);
    const safeName = result.vendor.replace(/[^a-zA-Z0-9]/g, "_");
    downloadExcelFromBase64(
      result.excel_base64,
      `stock_muerto_${safeName}_${result.days_without_sales}d_${date}.xlsx`,
    );
  };

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="rounded-xl border border-border/50 bg-card p-6 flex items-center justify-between">
        <div>
          <p className="font-semibold">Excel listo para descargar</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {result.dead_stock_variants} variantes sin ventas en {result.days_without_sales} dias
          </p>
        </div>
        <Button className="press-effect" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Descargar Excel
        </Button>
      </div>
    </div>
  );
}
