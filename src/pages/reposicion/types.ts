// ===== Tipos e interfaces para Reposición de Inventario =====

export type UrgencyLevel = "URGENTE" | "PRONTO" | "NORMAL" | "OK";
export type Classification = "Bestseller" | "Regular" | "Slow" | "Long Tail";

export interface ProductAnalysis {
  sku: string;
  title: string;
  vendor: string;
  classification: Classification;
  classificationLabel: string;
  salesPerMonth: number;
  salesPerWeek: number;
  salesPerDay: number;
  totalSold: number;
  stock: number;
  daysOfInventory: number | "N/A";
  urgency: UrgencyLevel;
  urgencyLabel: string;
  reorderPoint: number;
  needsReorder: boolean;
  orderQuantity: number;
}

export interface VendorSummary {
  vendor: string;
  titles: number;
  units: number;
  urgentCount: number;
  items: ProductAnalysis[];
}

export interface ReplenishmentStats {
  totalProducts: number;
  needReplenishment: number;
  urgent: number;
  outOfStock: number;
  vendorsWithOrders: number;
}

export interface ReplenishmentResult {
  products: ProductAnalysis[];
  vendors: VendorSummary[];
  stats: ReplenishmentStats;
}

export interface SedeInfo {
  label: string;
  index: number;
}

export interface SalesRecord {
  sku: string;
  title: string;
  vendor: string;
  quantity: number;
  month: string;
}

export interface InventoryRecord {
  sku: string;
  title: string;
  vendor: string;
  stockBySede: Record<string, number>;
}

// ===== Constantes =====

export const SAFETY_FACTOR = 1.5;

export const URGENCY_THRESHOLDS = {
  URGENT: 7,
  SOON: 14,
  NORMAL: 30,
} as const;

export const CLASSIFICATION_THRESHOLDS = {
  BESTSELLER: 10,
  REGULAR: 3,
  SLOW: 1,
} as const;

export const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; order: number }> = {
  URGENTE: { label: "URGENTE", order: 0 },
  PRONTO: { label: "PRONTO", order: 1 },
  NORMAL: { label: "NORMAL", order: 2 },
  OK: { label: "OK", order: 3 },
};

export const CLASSIFICATION_CONFIG: Record<Classification, { label: string }> = {
  Bestseller: { label: "Bestseller" },
  Regular: { label: "Venta Regular" },
  Slow: { label: "Venta Lenta" },
  "Long Tail": { label: "Cola Larga" },
};
