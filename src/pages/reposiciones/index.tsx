import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import ConfigPanel from "./components/ConfigPanel";
import SuggestionsTable from "./components/SuggestionsTable";
import VendorSummaryPanel from "./components/VendorSummaryPanel";
import {
  useLocations,
  useVendors,
  useReplenishmentConfig,
  saveReplenishmentConfig,
  useCalculationFlow,
} from "./hooks";
import type { CalculateRequest } from "./types";

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "destructive" | "warning";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-2xl font-bold",
            variant === "destructive" && "text-red-600 dark:text-red-400",
            variant === "warning" && "text-amber-600 dark:text-amber-400"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "hace un momento";
  if (diffMinutes < 60) return `hace ${diffMinutes} minuto${diffMinutes === 1 ? "" : "s"}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours === 1 ? "" : "s"}`;
  return `hace ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
}

// ─── CacheProgressPlaceholder ────────────────────────────────────────────────

function CacheProgressPlaceholder({ objectCount }: { objectCount?: number }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Actualizando datos de ventas...</p>
          {objectCount !== undefined && objectCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {objectCount.toLocaleString()} registros procesados
            </span>
          )}
        </div>
        <Progress className="w-full animate-pulse" value={undefined} />
      </CardContent>
    </Card>
  );
}

// ─── Default config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  location_id: "",
  vendors: [] as string[],
  lead_time_days: 14,
  safety_factor: 1.5,
  date_range_months: 6,
};

// ─── Page component ──────────────────────────────────────────────────────────

export default function ReposicionesPage() {
  const { user } = useAuth();

  const locations = useLocations();
  const vendors = useVendors();
  const savedConfig = useReplenishmentConfig(user?.uid);
  const { results, isPolling, isCalculating, salesStatus, startCalculation } =
    useCalculationFlow();

  const [config, setConfig] = useState(DEFAULT_CONFIG);

  // Override/deletion state — persists across recalculations (keyed by SKU string)
  const [overridesMap, setOverridesMap] = useState<Record<string, number>>({});
  const [deletedSkus, setDeletedSkus] = useState<Set<string>>(new Set());

  // Store draft_id for Phase 7 approval flow
  const [draftId, setDraftId] = useState<string | null>(null);

  // Merge saved Firestore config when it loads
  useEffect(() => {
    if (!savedConfig.data) return;

    const saved = savedConfig.data;
    setConfig((prev) => ({
      location_id:
        saved.location_id ||
        (locations.data && locations.data.length > 0
          ? locations.data[0].id
          : prev.location_id),
      vendors: saved.vendors ?? [],
      lead_time_days: saved.lead_time_days ?? DEFAULT_CONFIG.lead_time_days,
      safety_factor: saved.safety_factor ?? DEFAULT_CONFIG.safety_factor,
      date_range_months: saved.date_range_days
        ? Math.round(saved.date_range_days / 30)
        : DEFAULT_CONFIG.date_range_months,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedConfig.data]);

  // When locations load and no location_id yet, default to first
  useEffect(() => {
    if (!config.location_id && locations.data && locations.data.length > 0) {
      setConfig((prev) => ({
        ...prev,
        location_id: locations.data![0].id,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations.data]);

  // When results come back, store draft_id (overridesMap and deletedSkus are NOT reset)
  useEffect(() => {
    if (results?.draft_id) {
      setDraftId(results.draft_id);
    }
  }, [results]);

  async function handleCalcular() {
    if (!user?.uid || !config.location_id) return;

    const request: CalculateRequest = {
      location_id: config.location_id,
      vendors: config.vendors.length > 0 ? config.vendors : null,
      lead_time_days: config.lead_time_days,
      safety_factor: config.safety_factor,
      date_range_days: config.date_range_months * 30,
    };

    // Persist config to Firestore (fire-and-forget)
    saveReplenishmentConfig(user.uid, {
      location_id: config.location_id,
      vendors: config.vendors,
      lead_time_days: config.lead_time_days,
      safety_factor: config.safety_factor,
      date_range_days: config.date_range_months * 30,
    }).catch((err) => {
      console.error("Error saving config:", err);
    });

    await startCalculation(request);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reposiciones</h1>
        {salesStatus?.last_refreshed && (
          <span className="text-sm text-muted-foreground">
            Datos actualizados: {formatTimeAgo(salesStatus.last_refreshed)}
          </span>
        )}
      </div>

      {/* Config section */}
      <ConfigPanel
        locations={locations.data ?? []}
        vendors={vendors.data ?? []}
        config={config}
        onConfigChange={setConfig}
        onCalcular={handleCalcular}
        isLoading={isCalculating || isPolling}
        isLocationsLoading={locations.isLoading}
        isVendorsLoading={vendors.isLoading}
      />

      {/* Cache refresh progress bar */}
      {isPolling && (
        <CacheProgressPlaceholder objectCount={salesStatus?.object_count} />
      )}

      {/* Results section — only after successful calculation */}
      {results && (
        <div className="space-y-6">
          {/* Stats summary bar — APPR-01 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Productos" value={results.stats.total_products} />
            <StatCard
              label="Necesitan Reposicion"
              value={results.stats.needs_replenishment}
            />
            <StatCard
              label="Urgentes"
              value={results.stats.urgent}
              variant="destructive"
            />
            <StatCard
              label="Agotados"
              value={results.stats.out_of_stock}
              variant="warning"
            />
            <StatCard label="Proveedores" value={results.stats.vendors_with_orders} />
          </div>

          {/* Editable suggestions table — APPR-02, APPR-03 */}
          <SuggestionsTable
            products={results.products}
            overridesMap={overridesMap}
            onOverrideChange={(sku, qty) =>
              setOverridesMap((prev) => ({ ...prev, [sku]: qty }))
            }
            deletedSkus={deletedSkus}
            onDeleteSku={(sku) =>
              setDeletedSkus((prev) => new Set(prev).add(sku))
            }
          />

          {/* Vendor summary reflecting edits and deletions — APPR-04 */}
          <VendorSummaryPanel
            products={results.products}
            overridesMap={overridesMap}
            deletedSkus={deletedSkus}
          />

          {/* Hidden: draft_id available for Phase 7 approval flow */}
          {draftId && (
            <input type="hidden" name="draft_id" value={draftId} />
          )}
        </div>
      )}
    </div>
  );
}
