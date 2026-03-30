export type UrgencyLevel = "URGENTE" | "PRONTO" | "NORMAL" | "OK";
export type Classification = "Bestseller" | "Regular" | "Slow" | "Long Tail";

export interface LocationItem {
  name: string;
  id: string;
}

export interface VendorItem {
  name: string;
  product_count: number;
}

export interface ProductResult {
  sku: string;
  title: string;
  vendor: string;
  classification: Classification;
  classification_label: string;
  sales_per_month: number;
  sales_per_week: number;
  sales_per_day: number;
  total_sold: number;
  stock: number;
  days_of_inventory: number | null;
  urgency: UrgencyLevel;
  urgency_label: string;
  reorder_point: number;
  needs_reorder: boolean;
  suggested_qty: number;
  in_transit_real: number;
}

export interface VendorSummaryResult {
  vendor: string;
  total_skus: number;
  total_units_to_order: number;
  urgent_count: number;
}

export interface ReplenishmentStatsResult {
  total_products: number;
  needs_replenishment: number;
  urgent: number;
  out_of_stock: number;
  vendors_with_orders: number;
}

export interface CalculateResponse {
  products: ProductResult[];
  vendor_summary: VendorSummaryResult[];
  stats: ReplenishmentStatsResult;
  draft_id: string;
}

export interface CalculateRequest {
  location_id: string;
  vendors: string[] | null;
  lead_time_days: number;
  safety_factor: number;
  date_range_days: number;
}

export interface ReplenishmentConfig {
  location_id: string;
  vendors: string[];
  lead_time_days: number;
  safety_factor: number;
  date_range_days: number;
  updated_at?: unknown;
}

export interface SalesStatusResponse {
  status: "idle" | "running" | "completed" | "failed";
  object_count?: number;
  last_refreshed?: string;
  sku_count?: number;
  error?: string;
}

export interface SalesRefreshResponse {
  status: string;
  message: string;
  job_id?: string;
}
