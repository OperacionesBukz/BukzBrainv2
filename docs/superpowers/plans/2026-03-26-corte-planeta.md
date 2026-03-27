# Corte Planeta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-phase workflow page for processing Grupo Editorial Planeta monthly sales cuts — warehouse cleanup, discount processing, and email delivery.

**Architecture:** Phase 1 runs entirely in the browser (xlsx parsing + POS location renaming). Phase 2 reuses existing backend endpoints for discount processing. Phase 3 adds one new backend endpoint that uses the existing `send_email()` service. State lives in the parent component — no Firestore persistence needed.

**Tech Stack:** React 18 + TypeScript, xlsx (SheetJS) already installed, shadcn/ui components, FastAPI backend with existing SMTP service.

---

## File Structure

### Frontend — Create

| File | Responsibility |
|------|----------------|
| `src/pages/corte-planeta/constants.ts` | Default bodega mappings, target bodegas, default email recipients, month names |
| `src/pages/corte-planeta/types.ts` | Shared TypeScript interfaces for all phases |
| `src/pages/corte-planeta/PlanetaStepIndicator.tsx` | Visual 3-step indicator with active/completed/pending states |
| `src/pages/corte-planeta/PlanetaPhase1Bodegas.tsx` | Phase 1: file upload, auto-mapping, manual assignment, download |
| `src/pages/corte-planeta/PlanetaPhase2Descuentos.tsx` | Phase 2: discount type selection, processing, results display |
| `src/pages/corte-planeta/PlanetaPhase3Correo.tsx` | Phase 3: recipients, dates, preview, send email |
| `src/pages/corte-planeta/api.ts` | API call for sending the Planeta email |

### Frontend — Modify

| File | Change |
|------|--------|
| `src/pages/CortePlaneta.tsx` | Replace placeholder with stepper + phase components |

### Backend — Create

| File | Responsibility |
|------|----------------|
| `backend/routers/corte_planeta.py` | Single endpoint: `POST /api/corte-planeta/enviar-correo` |

### Backend — Modify

| File | Change |
|------|--------|
| `backend/main.py` | Register `corte_planeta` router |

---

### Task 1: Constants and Types

**Files:**
- Create: `src/pages/corte-planeta/constants.ts`
- Create: `src/pages/corte-planeta/types.ts`

- [ ] **Step 1: Create constants.ts**

```ts
export const BODEGA_TARGETS = [
  "Bukz Medellín",
  "Bukz Bogotá",
  "Bukz B2B Medellín",
] as const;

export type BodegaTarget = (typeof BODEGA_TARGETS)[number];

export const DEFAULT_BODEGA_MAPPINGS: Record<string, BodegaTarget> = {
  "Bukz Las Lomas": "Bukz Medellín",
  "Bukz Museo de Antioquia": "Bukz Medellín",
  "Bukz Viva Envigado": "Bukz Medellín",
  "Bukz Bogota 109": "Bukz Bogotá",
  "Reserva B2B": "Bukz B2B Medellín",
};

export const DEFAULT_RECIPIENTS = [
  "mromero@planeta.com.co",
  "ovargas@planeta.com.co",
];

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const LOCAL_STORAGE_KEY = "planeta-bodega-mappings";
```

- [ ] **Step 2: Create types.ts**

```ts
export { API_BASE } from "../ingreso/types";

export interface PlanetaRow {
  orderName: string;
  sku: string;
  productTitle: string;
  vendor: string;
  posLocation: string;
  salesChannel: string;
  discountName: string;
  netItemsSold: number;
}

export type DiscountType = "3x2" | "porcentaje" | "sin-descuento";

export type PlanetaPhase = 1 | 2 | 3;
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/corte-planeta/constants.ts src/pages/corte-planeta/types.ts
git commit -m "feat(corte-planeta): add constants and types for 3-phase workflow"
```

---

### Task 2: Step Indicator Component

**Files:**
- Create: `src/pages/corte-planeta/PlanetaStepIndicator.tsx`

- [ ] **Step 1: Create the step indicator**

```tsx
import { Check } from "lucide-react";
import type { PlanetaPhase } from "./types";

interface Props {
  currentPhase: PlanetaPhase;
  onPhaseClick: (phase: PlanetaPhase) => void;
  completedPhases: Set<number>;
}

const STEPS: { phase: PlanetaPhase; label: string }[] = [
  { phase: 1, label: "Bodegas" },
  { phase: 2, label: "Descuentos" },
  { phase: 3, label: "Enviar Correo" },
];

export default function PlanetaStepIndicator({ currentPhase, onPhaseClick, completedPhases }: Props) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map(({ phase, label }, i) => {
        const isCompleted = completedPhases.has(phase);
        const isActive = phase === currentPhase;
        const canClick = isCompleted || phase < currentPhase;

        return (
          <div key={phase} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-px w-8 md:w-12 ${isCompleted || isActive ? "bg-primary" : "bg-border"}`} />
            )}
            <button
              onClick={() => canClick && onPhaseClick(phase)}
              disabled={!canClick}
              className={`
                flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${isActive ? "bg-primary/10 text-primary border border-primary/30" : ""}
                ${isCompleted && !isActive ? "text-muted-foreground hover:text-foreground cursor-pointer" : ""}
                ${!isCompleted && !isActive ? "text-muted-foreground/50 cursor-not-allowed" : ""}
              `}
            >
              <span className={`
                flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                ${isActive ? "bg-primary text-primary-foreground" : ""}
                ${isCompleted && !isActive ? "bg-primary/20 text-primary" : ""}
                ${!isCompleted && !isActive ? "bg-muted text-muted-foreground/50" : ""}
              `}>
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : phase}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/corte-planeta/PlanetaStepIndicator.tsx
git commit -m "feat(corte-planeta): add step indicator component"
```

---

### Task 3: Phase 1 — Bodegas

**Files:**
- Create: `src/pages/corte-planeta/PlanetaPhase1Bodegas.tsx`

- [ ] **Step 1: Create Phase 1 component**

```tsx
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

function getAllMappings(): Record<string, BodegaTarget> {
  return { ...DEFAULT_BODEGA_MAPPINGS, ...getCustomMappings() };
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

  const allMappings = useMemo(() => ({ ...DEFAULT_BODEGA_MAPPINGS, ...customMappings }), [customMappings]);

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
    const unresolved = unknownLocations.filter((loc) => !manualAssignments[loc]);
    if (unresolved.length > 0) {
      toast.error("Asigna todas las ubicaciones antes de continuar");
      return;
    }

    const updated = rows.map((row) => {
      if (manualAssignments[row.posLocation]) {
        return { ...row, posLocation: manualAssignments[row.posLocation] };
      }
      return row;
    });

    setRows(updated);
    setStep("done");
    toast.success(`${updated.length} filas procesadas correctamente`);
  }, [rows, unknownLocations, manualAssignments]);

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

  // Summary counts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/corte-planeta/PlanetaPhase1Bodegas.tsx
git commit -m "feat(corte-planeta): add Phase 1 bodegas component with auto-mapping and config"
```

---

### Task 4: Phase 2 — Descuentos

**Files:**
- Create: `src/pages/corte-planeta/PlanetaPhase2Descuentos.tsx`

- [ ] **Step 1: Create Phase 2 component**

```tsx
import { useState, useCallback } from "react";
import { Loader2, RotateCcw, Download } from "lucide-react";
import { toast } from "sonner";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import CortesUpload from "../operations/cortes/CortesUpload";
import CortesResultTable from "../operations/cortes/CortesResultTable";
import DescuentoResultTable from "../operations/cortes/DescuentoResultTable";
import { processCortes, processDescuento, downloadBlob } from "../operations/cortes/api";
import type { CortesRow, DescuentoRow } from "../operations/cortes/types";
import type { DiscountType } from "./types";

interface Props {
  onComplete: () => void;
}

type Step = "config" | "processing" | "results";

function parseCortesBlob(blob: Blob): Promise<CortesRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        resolve(raw.map((r) => ({
          orderName: String(r["Order name"] ?? ""),
          sku: String(r["Product variant SKU"] ?? ""),
          productTitle: String(r["Product title"] ?? ""),
          vendor: String(r["Product vendor"] ?? ""),
          posLocation: String(r["POS location name"] ?? ""),
          salesChannel: String(r["Sales channel"] ?? ""),
          discountName: String(r["Discount name"] ?? ""),
          netItemsSold: Number(r["Net items sold"] ?? 0),
          detalle: String(r["Detalle"] ?? ""),
          udsConDescuento: Number(r["Uds con descuento"] ?? 0),
        })));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsArrayBuffer(blob);
  });
}

function parseDescuentoBlob(blob: Blob, pct: number): Promise<DescuentoRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        resolve(raw.map((r) => ({
          orderName: String(r["Order name"] ?? ""),
          sku: String(r["Product variant SKU"] ?? ""),
          productTitle: String(r["Product title"] ?? ""),
          vendor: String(r["Product vendor"] ?? ""),
          discountName: String(r["Discount name"] ?? ""),
          netItemsSold: Number(r["Net items sold"] ?? 0),
          pctEsperado: pct,
          pctReal: Number(r["% Real"] ?? 0),
          detalle: String(r["Detalle"] ?? ""),
        })));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo"));
    reader.readAsArrayBuffer(blob);
  });
}

export default function PlanetaPhase2Descuentos({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("config");
  const [discountType, setDiscountType] = useState<DiscountType>("sin-descuento");
  const [porcentaje, setPorcentaje] = useState(30);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  // Results state
  const [cortesRows, setCortesRows] = useState<CortesRow[]>([]);
  const [descuentoRows, setDescuentoRows] = useState<DescuentoRow[]>([]);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setFileName(file.name.replace(/\.[^.]+$/, "_descuento.xlsx"));
  }, []);

  const handleProcess = useCallback(async () => {
    if (discountType === "sin-descuento") {
      onComplete();
      return;
    }

    if (!selectedFile) {
      toast.error("Selecciona un archivo primero");
      return;
    }

    setStep("processing");

    try {
      if (discountType === "3x2") {
        const blob = await processCortes(selectedFile);
        setResultBlob(blob);
        const rows = await parseCortesBlob(blob);
        setCortesRows(rows);
        const regalos = rows.filter((r) => r.detalle === "Regalo").length;
        toast.success(`Procesado: ${regalos} regalo${regalos !== 1 ? "s" : ""} identificado${regalos !== 1 ? "s" : ""}`);
      } else {
        const blob = await processDescuento(selectedFile, porcentaje);
        setResultBlob(blob);
        const rows = await parseDescuentoBlob(blob, porcentaje);
        setDescuentoRows(rows);
        const conDesc = rows.filter((r) => r.detalle === "Con descuento").length;
        toast.success(`Procesado: ${conDesc} libro${conDesc !== 1 ? "s" : ""} con descuento`);
      }

      setStep("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error procesando archivo";
      toast.error(msg);
      setStep("config");
    }
  }, [selectedFile, discountType, porcentaje, onComplete]);

  const handleDownload = useCallback(() => {
    if (resultBlob) downloadBlob(resultBlob, fileName);
  }, [resultBlob, fileName]);

  const handleReset = useCallback(() => {
    setStep("config");
    setCortesRows([]);
    setDescuentoRows([]);
    setResultBlob(null);
    setSelectedFile(null);
    setFileName("");
  }, []);

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de descuento</Label>
            <RadioGroup value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3x2" id="dt-3x2" />
                <Label htmlFor="dt-3x2" className="font-normal">3x2</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="porcentaje" id="dt-pct" />
                <Label htmlFor="dt-pct" className="font-normal">% Descuento</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sin-descuento" id="dt-none" />
                <Label htmlFor="dt-none" className="font-normal">Sin descuento este mes</Label>
              </div>
            </RadioGroup>
          </div>

          {discountType === "porcentaje" && (
            <div className="space-y-1.5">
              <Label htmlFor="pct-planeta">% Descuento esperado</Label>
              <Input
                id="pct-planeta"
                type="number"
                min={1}
                max={100}
                value={porcentaje}
                onChange={(e) => setPorcentaje(Number(e.target.value))}
                className="w-32"
              />
            </div>
          )}

          {discountType !== "sin-descuento" && (
            <CortesUpload onFileSelected={handleFileSelected} />
          )}

          <Button onClick={handleProcess}>
            {discountType === "sin-descuento" ? "Continuar sin descuento →" : "Procesar archivo"}
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Consultando pedidos en Shopify...</p>
          <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
        </div>
      )}

      {step === "results" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {discountType === "3x2" ? `${cortesRows.length} filas procesadas` : `${descuentoRows.length} filas procesadas — descuento esperado: ${porcentaje}%`}
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reiniciar
            </Button>
          </div>

          {discountType === "3x2" ? (
            <CortesResultTable rows={cortesRows} onDownload={handleDownload} />
          ) : (
            <DescuentoResultTable rows={descuentoRows} onDownload={handleDownload} />
          )}

          <Button variant="outline" onClick={onComplete}>
            Continuar a Enviar Correo →
          </Button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/corte-planeta/PlanetaPhase2Descuentos.tsx
git commit -m "feat(corte-planeta): add Phase 2 descuentos component reusing existing backend"
```

---

### Task 5: Backend — Corte Planeta Email Endpoint

**Files:**
- Create: `backend/routers/corte_planeta.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create the router**

```python
"""
Router para Corte Planeta — envío de correo con archivo adjunto.
"""
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from services.email_service import send_email

router = APIRouter(prefix="/api/corte-planeta", tags=["corte-planeta"])


def build_planeta_html(fecha_inicio: str, fecha_fin: str) -> str:
    """Template HTML para correo de corte Planeta."""
    return f"""<p>Buenas tardes, espero que se encuentren muy bien.</p>

<p>Adjunto env&iacute;o el corte correspondiente al per&iacute;odo comprendido entre el {fecha_inicio} y el {fecha_fin}.</p>

<p>En el archivo podr&aacute;n encontrar el detalle de:</p>
<ul>
    <li>T&iacute;tulos vendidos por ciudad</li>
    <li>Cantidades correspondientes</li>
</ul>

<p>Quedo atento a cualquier inquietud, comentario o solicitud de informaci&oacute;n adicional.</p>

<p>Cordial saludo,</p>"""


@router.post("/enviar-correo")
async def enviar_correo(
    file: UploadFile = File(...),
    destinatarios: str = Form(...),
    fecha_inicio: str = Form(...),
    fecha_fin: str = Form(...),
    asunto: str = Form(...),
):
    """Envía el correo del corte Planeta con archivo adjunto."""
    try:
        recipients = json.loads(destinatarios)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Lista de destinatarios inválida")

    if not recipients:
        raise HTTPException(status_code=400, detail="Se requiere al menos un destinatario")

    file_content = await file.read()
    if not file_content:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    html_body = build_planeta_html(fecha_inicio, fecha_fin)

    try:
        send_email(
            to=recipients,
            subject=asunto,
            html_body=html_body,
            sender_name="Bukz Operaciones",
            attachments=[(file.filename or "corte_planeta.xlsx", file_content)],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando correo: {e}")

    return {"success": True, "message": "Correo enviado exitosamente"}
```

- [ ] **Step 2: Register router in main.py**

Add import and include_router in `backend/main.py`:

```python
# After line: from routers import devoluciones
from routers import corte_planeta
```

```python
# After line: app.include_router(devoluciones.router)
app.include_router(corte_planeta.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/routers/corte_planeta.py backend/main.py
git commit -m "feat(corte-planeta): add backend endpoint for sending Planeta email"
```

---

### Task 6: Frontend API and Phase 3 — Correo

**Files:**
- Create: `src/pages/corte-planeta/api.ts`
- Create: `src/pages/corte-planeta/PlanetaPhase3Correo.tsx`

- [ ] **Step 1: Create api.ts**

```ts
import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE } from "./types";

export async function enviarCorreoPlaneta(
  file: File,
  destinatarios: string[],
  fechaInicio: string,
  fechaFin: string,
  asunto: string,
): Promise<{ success: boolean; message: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("destinatarios", JSON.stringify(destinatarios));
  form.append("fecha_inicio", fechaInicio);
  form.append("fecha_fin", fechaFin);
  form.append("asunto", asunto);

  const res = await resilientFetch(`${API_BASE}/api/corte-planeta/enviar-correo`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${res.status})`);
  }

  return res.json();
}
```

- [ ] **Step 2: Create Phase 3 component**

```tsx
import { useState, useCallback, useMemo } from "react";
import { Loader2, Send, Plus, Trash2, Upload, FileSpreadsheet, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_RECIPIENTS, MESES } from "./constants";
import { enviarCorreoPlaneta } from "./api";

interface Props {
  onComplete: () => void;
}

function getDefaultDates(): { inicio: string; fin: string; mesInicio: string; mesFin: string; anio: number } {
  const now = new Date();
  const anio = now.getFullYear();
  const mesActual = now.getMonth(); // 0-indexed

  const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
  const anioInicio = mesActual === 0 ? anio - 1 : anio;

  return {
    inicio: `25 de ${MESES[mesAnterior].toLowerCase()} de ${anioInicio}`,
    fin: `24 de ${MESES[mesActual].toLowerCase()} de ${anio}`,
    mesInicio: MESES[mesAnterior],
    mesFin: MESES[mesActual],
    anio,
  };
}

export default function PlanetaPhase3Correo({ onComplete }: Props) {
  const defaults = useMemo(() => getDefaultDates(), []);

  const [recipients, setRecipients] = useState<string[]>([...DEFAULT_RECIPIENTS]);
  const [newEmail, setNewEmail] = useState("");
  const [fechaInicio, setFechaInicio] = useState(defaults.inicio);
  const [fechaFin, setFechaFin] = useState(defaults.fin);
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const asunto = useMemo(() => {
    return `Corte ${defaults.mesInicio} a ${defaults.mesFin} - ${defaults.anio} - Grupo Editorial Planeta`;
  }, [defaults]);

  const handleAddEmail = useCallback(() => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Ingresa un correo válido");
      return;
    }
    if (recipients.includes(email)) {
      toast.error("Este correo ya está en la lista");
      return;
    }
    setRecipients((prev) => [...prev, email]);
    setNewEmail("");
  }, [newEmail, recipients]);

  const handleRemoveEmail = useCallback((email: string) => {
    setRecipients((prev) => prev.filter((e) => e !== email));
  }, []);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      toast.error("Solo se aceptan archivos .xlsx o .xls");
      return;
    }
    setFile(f);
  }, []);

  const handleSend = useCallback(async () => {
    if (!file) {
      toast.error("Selecciona un archivo para adjuntar");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Agrega al menos un destinatario");
      return;
    }

    setIsSending(true);

    try {
      await enviarCorreoPlaneta(file, recipients, fechaInicio, fechaFin, asunto);
      toast.success("Correo enviado exitosamente");
      setSent(true);
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error enviando correo";
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  }, [file, recipients, fechaInicio, fechaFin, asunto, onComplete]);

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-lg font-medium">Correo enviado exitosamente</p>
        <p className="text-sm text-muted-foreground">
          Enviado a {recipients.join(", ")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File upload */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Archivo adjunto</Label>
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-muted-foreground/25 p-4">
            <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => document.getElementById("planeta-correo-input")?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
            `}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Arrastra el archivo final aquí</p>
            <p className="text-xs text-muted-foreground">o haz clic para seleccionar (.xlsx, .xls)</p>
            <input
              id="planeta-correo-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Destinatarios</Label>
        <div className="space-y-2">
          {recipients.map((email) => (
            <div key={email} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span className="text-sm flex-1">{email}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemoveEmail(email)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
            placeholder="Agregar correo..."
            className="flex-1"
          />
          <Button size="sm" variant="outline" onClick={handleAddEmail} disabled={!newEmail.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fecha-inicio">Fecha inicio del período</Label>
          <Input
            id="fecha-inicio"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fecha-fin">Fecha fin del período</Label>
          <Input
            id="fecha-fin"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label>Asunto</Label>
        <p className="text-sm rounded-lg border bg-muted/50 px-3 py-2">{asunto}</p>
      </div>

      {/* Preview */}
      <div className="space-y-1.5">
        <Label>Vista previa del correo</Label>
        <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-3">
          <p>Buenas tardes, espero que se encuentren muy bien.</p>
          <p>Adjunto envío el corte correspondiente al período comprendido entre el {fechaInicio} y el {fechaFin}.</p>
          <p>En el archivo podrán encontrar el detalle de:</p>
          <ul className="list-disc list-inside">
            <li>Títulos vendidos por ciudad</li>
            <li>Cantidades correspondientes</li>
          </ul>
          <p>Quedo atento a cualquier inquietud, comentario o solicitud de información adicional.</p>
          <p>Cordial saludo,</p>
        </div>
      </div>

      {/* Send */}
      <Button onClick={handleSend} disabled={isSending || !file || recipients.length === 0}>
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Enviar correo
          </>
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/corte-planeta/api.ts src/pages/corte-planeta/PlanetaPhase3Correo.tsx
git commit -m "feat(corte-planeta): add Phase 3 email component and API"
```

---

### Task 7: Main Page — Wire Everything Together

**Files:**
- Modify: `src/pages/CortePlaneta.tsx`

- [ ] **Step 1: Replace CortePlaneta.tsx with stepper page**

```tsx
import { useState, useCallback } from "react";
import PlanetaStepIndicator from "./corte-planeta/PlanetaStepIndicator";
import PlanetaPhase1Bodegas from "./corte-planeta/PlanetaPhase1Bodegas";
import PlanetaPhase2Descuentos from "./corte-planeta/PlanetaPhase2Descuentos";
import PlanetaPhase3Correo from "./corte-planeta/PlanetaPhase3Correo";
import type { PlanetaPhase } from "./corte-planeta/types";

export default function CortePlaneta() {
  const [currentPhase, setCurrentPhase] = useState<PlanetaPhase>(1);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());

  const completePhase = useCallback((phase: PlanetaPhase) => {
    setCompletedPhases((prev) => new Set(prev).add(phase));
    if (phase < 3) {
      setCurrentPhase((phase + 1) as PlanetaPhase);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          Corte Planeta
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Procesamiento del corte mensual de Grupo Editorial Planeta
        </p>
      </div>

      <PlanetaStepIndicator
        currentPhase={currentPhase}
        onPhaseClick={setCurrentPhase}
        completedPhases={completedPhases}
      />

      <div className="rounded-lg border bg-card p-6">
        {currentPhase === 1 && (
          <PlanetaPhase1Bodegas onComplete={() => completePhase(1)} />
        )}
        {currentPhase === 2 && (
          <PlanetaPhase2Descuentos onComplete={() => completePhase(2)} />
        )}
        {currentPhase === 3 && (
          <PlanetaPhase3Correo onComplete={() => completePhase(3)} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/CortePlaneta.tsx
git commit -m "feat(corte-planeta): wire stepper page with all 3 phases"
```

---

### Task 8: Verify Build and Test

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 3: Run dev server and manually test**

```bash
npm run dev
```

Navigate to `/BukzBrainv2/corte-planeta` and verify:
- Step indicator shows 3 phases
- Phase 1: file upload area + config panel works
- Phase 2: discount type selection shows 3 options
- Phase 3: recipients, dates, preview render correctly
- Navigation between phases works

- [ ] **Step 4: Fix any issues found, commit**

```bash
git add -A
git commit -m "fix(corte-planeta): address build/test issues"
```
