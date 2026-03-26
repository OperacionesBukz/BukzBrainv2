import { useState, useCallback, useMemo } from "react";
import { read, utils, writeFileXLSX } from "xlsx";
import { Download, Upload, Settings, Trash2, Plus, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BODEGA_TARGETS,
  DEFAULT_BODEGA_MAPPINGS,
  LOCAL_STORAGE_KEY,
  type BodegaTarget,
} from "./constants";
import type { PlanetaRow } from "./types";

interface Props {
  onComplete: () => void;
}

type Step = "upload" | "resolve" | "done";

function getCustomMappings(): Record<string, BodegaTarget> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomMappings(mappings: Record<string, BodegaTarget>) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mappings));
}

export default function PlanetaPhase1Bodegas({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<PlanetaRow[]>([]);
  const [unknownLocations, setUnknownLocations] = useState<string[]>([]);
  const [manualAssignments, setManualAssignments] = useState<Record<string, BodegaTarget>>({});
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Config panel state
  const [configOpen, setConfigOpen] = useState(false);
  const [customMappings, setCustomMappings] = useState<Record<string, BodegaTarget>>(getCustomMappings);
  const [newMappingKey, setNewMappingKey] = useState("");
  const [newMappingValue, setNewMappingValue] = useState<BodegaTarget>("Bukz Medellín");

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      toast.error("Solo se aceptan archivos .xlsx o .xls");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const mappings = { ...DEFAULT_BODEGA_MAPPINGS, ...customMappings };
        const targetSet = new Set<string>(BODEGA_TARGETS);
        const unknowns = new Set<string>();

        const parsed: PlanetaRow[] = raw.map((r) => {
          const posRaw = String(r["POS location name"] ?? "");
          let posLocation = posRaw;

          if (mappings[posRaw]) {
            posLocation = mappings[posRaw];
          } else if (!targetSet.has(posRaw)) {
            unknowns.add(posRaw);
          }

          return {
            orderName: String(r["Order name"] ?? ""),
            sku: String(r["Product variant SKU"] ?? ""),
            productTitle: String(r["Product title"] ?? ""),
            vendor: String(r["Product vendor"] ?? ""),
            posLocation,
            salesChannel: String(r["Sales channel"] ?? ""),
            discountName: String(r["Discount name"] ?? ""),
            netItemsSold: Number(r["Net items sold"] ?? 0),
          };
        });

        setRows(parsed);
        const unknownList = Array.from(unknowns).filter(Boolean);
        setUnknownLocations(unknownList);

        if (unknownList.length > 0) {
          setStep("resolve");
          toast.info(`${unknownList.length} ubicación(es) no reconocida(s)`);
        } else {
          setStep("done");
          toast.success(`${parsed.length} filas procesadas correctamente`);
        }
      } catch {
        toast.error("Error al leer el archivo Excel");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [customMappings]);

  const handleResolve = useCallback(() => {
    const updated = rows.map((row) => {
      if (manualAssignments[row.posLocation]) {
        return { ...row, posLocation: manualAssignments[row.posLocation] };
      }
      return row;
    });

    setRows(updated);
    setStep("done");
    toast.success(`${updated.length} filas procesadas correctamente`);
  }, [rows, manualAssignments]);

  const handleDownload = useCallback(() => {
    const data = rows.map((r) => ({
      "Order name": r.orderName,
      "Product variant SKU": r.sku,
      "Product title": r.productTitle,
      "Product vendor": r.vendor,
      "POS location name": r.posLocation,
      "Sales channel": r.salesChannel,
      "Discount name": r.discountName,
      "Net items sold": r.netItemsSold,
    }));

    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Corte Planeta");
    const outName = fileName.replace(/\.[^.]+$/, "_bodegas.xlsx");
    writeFileXLSX(wb, outName);
    toast.success("Archivo descargado");
  }, [rows, fileName]);

  const handleAddMapping = useCallback(() => {
    const key = newMappingKey.trim();
    if (!key) return;
    const updated = { ...customMappings, [key]: newMappingValue };
    setCustomMappings(updated);
    saveCustomMappings(updated);
    setNewMappingKey("");
    toast.success(`Mapeo "${key}" → "${newMappingValue}" guardado`);
  }, [newMappingKey, newMappingValue, customMappings]);

  const handleRemoveMapping = useCallback((key: string) => {
    const updated = { ...customMappings };
    delete updated[key];
    setCustomMappings(updated);
    saveCustomMappings(updated);
    toast.success(`Mapeo "${key}" eliminado`);
  }, [customMappings]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setRows([]);
    setUnknownLocations([]);
    setManualAssignments({});
    setFileName("");
  }, []);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.posLocation] = (counts[r.posLocation] || 0) + 1;
    }
    return counts;
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* Config panel */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurar mapeos
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Mapeos predeterminados</p>
          <div className="space-y-1">
            {Object.entries(DEFAULT_BODEGA_MAPPINGS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate">{k}</span>
                <span>→</span>
                <span className="font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>

          {Object.keys(customMappings).length > 0 && (
            <>
              <p className="text-sm font-medium mt-4">Mapeos personalizados</p>
              <div className="space-y-1">
                {Object.entries(customMappings).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{k}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{v}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={() => handleRemoveMapping(k)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-end gap-2 pt-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nombre original</Label>
              <Input
                value={newMappingKey}
                onChange={(e) => setNewMappingKey(e.target.value)}
                placeholder="Ej: Bukz Nueva Tienda"
                className="h-8 text-sm"
              />
            </div>
            <div className="w-44 space-y-1">
              <Label className="text-xs">Mapear a</Label>
              <Select value={newMappingValue} onValueChange={(v) => setNewMappingValue(v as BodegaTarget)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BODEGA_TARGETS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={handleAddMapping} disabled={!newMappingKey.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Upload */}
      {step === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById("planeta-file-input")?.click()}
          className={`
            flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
          `}
        >
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Arrastra el archivo de corte Planeta aquí</p>
            <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar (.xlsx, .xls)</p>
          </div>
          <input
            id="planeta-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            className="hidden"
          />
        </div>
      )}

      {/* Resolve unknown locations */}
      {step === "resolve" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ubicaciones no reconocidas</p>
              <p className="text-xs text-muted-foreground">Asigna cada ubicación a una bodega</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>

          <div className="space-y-3">
            {unknownLocations.map((loc) => (
              <div key={loc} className="flex items-center gap-3 rounded-lg border p-3">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{loc}</span>
                <span className="text-muted-foreground text-sm">→</span>
                <Select
                  value={manualAssignments[loc] ?? ""}
                  onValueChange={(v) => setManualAssignments((prev) => ({ ...prev, [loc]: v as BodegaTarget }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BODEGA_TARGETS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <Button onClick={handleResolve}>
            Aplicar y continuar
          </Button>
        </div>
      )}

      {/* Done — summary + download */}
      {step === "done" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {rows.length} filas procesadas
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>Nuevo archivo</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(summary).map(([loc, count]) => (
              <div key={loc} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{loc}</p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">filas</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel limpio
            </Button>
            <Button variant="outline" onClick={onComplete}>
              Continuar a Descuentos →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
