import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ConfigPanel from "./components/ConfigPanel";
import OrderHistoryTab from "./components/OrderHistoryTab";
import SuggestionsTable from "./components/SuggestionsTable";
import VendorSummaryPanel from "./components/VendorSummaryPanel";
import {
  useLocations,
  useVendors,
  useReplenishmentConfig,
  saveReplenishmentConfig,
  useCalculationFlow,
  useApprove,
  useGenerateOrders,
  useExportZip,
  useMarkSent,
} from "./hooks";
import type { CalculateRequest, EffectiveProductItem } from "./types";

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

  const [activeTab, setActiveTab] = useState<"sugerido" | "historial">("sugerido");

  const locations = useLocations();
  const vendors = useVendors();
  const savedConfig = useReplenishmentConfig(user?.uid);
  const { results, isPolling, isCalculating, salesStatus, startCalculation } =
    useCalculationFlow();

  const [config, setConfig] = useState(DEFAULT_CONFIG);

  // Override/deletion state — persists across recalculations (keyed by SKU string)
  const [overridesMap, setOverridesMap] = useState<Record<string, number>>({});
  const [deletedSkus, setDeletedSkus] = useState<Set<string>>(new Set());

  // Store draft_id for approval flow
  const [draftId, setDraftId] = useState<string | null>(null);

  // Phase 7: Approval & order flow state
  const [approvalState, setApprovalState] = useState<{
    status: "none" | "aprobado";
    approved_by: string;
    approved_at: string;
  }>({ status: "none", approved_by: "", approved_at: "" });
  const [generatedOrders, setGeneratedOrders] = useState<Record<string, string>>({});
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [sentVendors, setSentVendors] = useState<Set<string>>(new Set());
  const [markingSentVendor, setMarkingSentVendor] = useState<string | null>(null);

  const approveMutation = useApprove();
  const generateMutation = useGenerateOrders();
  const exportMutation = useExportZip();
  const markSentMutation = useMarkSent();

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
      // Reset approval state for new calculation
      setApprovalState({ status: "none", approved_by: "", approved_at: "" });
      setGeneratedOrders({});
      setSentVendors(new Set());
    }
  }, [results]);

  // Compute effective products: apply overrides + filter deleted skus
  const effectiveProducts = useMemo(() => {
    if (!results) return [];
    return results.products
      .filter((p) => !deletedSkus.has(p.sku))
      .map((p) => ({
        sku: p.sku,
        title: p.title,
        vendor: p.vendor,
        quantity: overridesMap[p.sku] ?? p.suggested_qty,
        stock: p.stock,
      } as EffectiveProductItem));
  }, [results, overridesMap, deletedSkus]);

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

  function handleAprobar() {
    if (!draftId || !user?.uid) return;
    approveMutation.mutate(
      {
        draft_id: draftId,
        approved_by: user.uid,
        effective_products: effectiveProducts,
      },
      {
        onSuccess: (data) => {
          setApprovalState({
            status: "aprobado",
            approved_by: user.displayName ?? user.email ?? user.uid,
            approved_at: data.approved_at,
          });
          const allVendors = new Set(
            effectiveProducts.map((p) => p.vendor).filter(Boolean)
          );
          setSelectedVendors(allVendors);
          toast.success("Sugerido aprobado correctamente");
        },
      }
    );
  }

  function handleVendorToggle(vendor: string) {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  }

  function handleGenerarPedidos() {
    if (!draftId || !user?.uid || selectedVendors.size === 0) return;
    generateMutation.mutate(
      {
        draft_id: draftId,
        vendors: Array.from(selectedVendors),
        created_by: user.uid,
      },
      {
        onSuccess: (data) => {
          const orderMap: Record<string, string> = {};
          for (const order of data.orders) {
            orderMap[order.vendor] = order.order_id;
          }
          setGeneratedOrders(orderMap);
          toast.success(`${data.orders.length} pedido(s) generado(s)`);
        },
      }
    );
  }

  function handleDescargarZip() {
    const orderIds = Object.values(generatedOrders);
    if (orderIds.length === 0) return;
    exportMutation.mutate({ order_ids: orderIds });
  }

  function handleMarkSent(vendor: string, orderId: string) {
    if (!user?.uid) return;
    setMarkingSentVendor(vendor);
    markSentMutation.mutate(
      { orderId, sentBy: user.uid },
      {
        onSuccess: () => {
          setSentVendors((prev) => new Set(prev).add(vendor));
          setMarkingSentVendor(null);
          toast.success(`Pedido de ${vendor} marcado como enviado`);
        },
        onSettled: () => setMarkingSentVendor(null),
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — stays outside tabs, visible on both */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reposiciones</h1>
        {salesStatus?.last_refreshed && (
          <span className="text-sm text-muted-foreground">
            Datos actualizados: {formatTimeAgo(salesStatus.last_refreshed)}
          </span>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sugerido" | "historial")}>
        <TabsList>
          <TabsTrigger value="sugerido">Nuevo Sugerido</TabsTrigger>
          <TabsTrigger value="historial">Historial de Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="sugerido" className="space-y-6">
          {/* Config section — disabled after approval */}
          <div className={approvalState.status === "aprobado" ? "opacity-50 pointer-events-none" : ""}>
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
          </div>

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
                <StatCard
                  label="Proveedores con pedidos"
                  value={Object.keys(generatedOrders).length || results.stats.vendors_with_orders}
                />
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

              {/* Approval section — APPR-05 */}
              {draftId && approvalState.status === "none" && (
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium">Aprobar Sugerido</p>
                    <p className="text-sm text-muted-foreground">
                      {effectiveProducts.length} productos ·{" "}
                      {new Set(effectiveProducts.map((p) => p.vendor)).size} proveedores
                    </p>
                  </div>
                  <Button
                    onClick={handleAprobar}
                    disabled={approveMutation.isPending || effectiveProducts.length === 0}
                  >
                    {approveMutation.isPending ? "Aprobando..." : "Aprobar Sugerido"}
                  </Button>
                </div>
              )}

              {approvalState.status === "aprobado" && (
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">
                    Aprobado
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    por {approvalState.approved_by} ·{" "}
                    {new Date(approvalState.approved_at).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}

              {/* Vendor summary with checkboxes — APPR-04, APPR-06 */}
              <VendorSummaryPanel
                products={results.products}
                overridesMap={overridesMap}
                deletedSkus={deletedSkus}
                isApproved={approvalState.status === "aprobado"}
                selectedVendors={selectedVendors}
                onVendorToggle={handleVendorToggle}
                ordersByVendor={Object.keys(generatedOrders).length > 0 ? generatedOrders : undefined}
                sentVendors={sentVendors}
                onMarkSent={handleMarkSent}
                isMarkingSent={markingSentVendor}
              />

              {/* Generate orders — APPR-06 + ORD-01 */}
              {approvalState.status === "aprobado" && Object.keys(generatedOrders).length === 0 && (
                <div className="flex justify-end gap-3">
                  <Button
                    onClick={handleGenerarPedidos}
                    disabled={generateMutation.isPending || selectedVendors.size === 0}
                  >
                    {generateMutation.isPending
                      ? "Generando..."
                      : `Generar Pedidos (${selectedVendors.size} proveedor${selectedVendors.size === 1 ? "" : "es"})`}
                  </Button>
                </div>
              )}

              {/* ZIP download — ORD-02, ORD-03 */}
              {Object.keys(generatedOrders).length > 0 && (
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleDescargarZip}
                    disabled={exportMutation.isPending}
                  >
                    {exportMutation.isPending ? "Generando ZIP..." : "Descargar ZIP"}
                  </Button>
                </div>
              )}

              {/* D-02: After orders generated, show link to history tab */}
              {Object.keys(generatedOrders).length > 0 && (
                <div className="flex justify-center">
                  <Button
                    variant="link"
                    onClick={() => setActiveTab("historial")}
                  >
                    Ver pedidos generados →
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial">
          <OrderHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
