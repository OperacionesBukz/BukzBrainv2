import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCacheStatus } from "../hooks";
import { forceRefreshCache } from "../api";
import { toast } from "sonner";

export default function CacheStatusBadge() {
  const { data: status, isLoading } = useCacheStatus();
  const [refreshing, setRefreshing] = useState(false);

  if (isLoading || !status) return null;

  const inventoryLocations = Object.values(status.inventory);
  const allInventoryFresh =
    inventoryLocations.length > 0 && inventoryLocations.every((l) => l.fresh);
  const salesFresh = status.sales.fresh;
  const allFresh = allInventoryFresh && salesFresh;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await forceRefreshCache("all");
      toast.success("Refresh de caches iniciado");
    } catch {
      toast.error("Error iniciando refresh");
    } finally {
      setTimeout(() => setRefreshing(false), 3000);
    }
  }

  const label = allFresh
    ? "Caches listos"
    : salesFresh
      ? "Inventario actualizando..."
      : "Cache pendiente";

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={allFresh ? "default" : "secondary"}
        className={cn(
          "text-xs cursor-default",
          allFresh &&
            "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0"
        )}
      >
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
            allFresh ? "bg-green-500" : "bg-amber-500 animate-pulse"
          )}
        />
        {label}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleRefresh}
        disabled={refreshing}
        title="Forzar refresh de caches"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
        />
      </Button>
    </div>
  );
}
