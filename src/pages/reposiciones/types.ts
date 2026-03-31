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

// ─── Phase 7: Approval, Orders, Export ────────────────────────────────────

export interface EffectiveProductItem {
  sku: string;
  title: string;
  vendor: string;
  quantity: number;
  stock: number;
}

export interface ApproveRequest {
  draft_id: string;
  approved_by: string;
  effective_products: EffectiveProductItem[];
}

export interface ApproveResponse {
  status: string;
  approved_at: string;
}

export interface OrderItem {
  sku: string;
  title: string;
  quantity: number;
  stock: number;
}

export interface ReplenishmentOrder {
  order_id: string;
  vendor: string;
  status: "aprobado" | "enviado" | "parcial" | "recibido";
  items: OrderItem[];
  created_by: string;
  created_at: string;
  sent_at?: string;
  sent_by?: string;
  enviado_at?: string;
  enviado_by?: string;
  parcial_at?: string;
  parcial_by?: string;
  recibido_at?: string;
  recibido_by?: string;
  approved_by?: string;
  approved_at?: string;
  status_history?: StatusHistoryEntry[];
}

export interface OrderCreated {
  order_id: string;
  vendor: string;
  item_count: number;
}

export interface GenerateOrdersRequest {
  draft_id: string;
  vendors: string[];
  created_by: string;
}

export interface GenerateOrdersResponse {
  orders: OrderCreated[];
}

export interface ExportOrdersRequest {
  order_ids: string[];
}

export interface ExportOrdersResponse {
  zip_base64: string;
  filename: string;
}

export interface MarkSentResponse {
  status: string;
  sent_at: string;
}

// ─── Phase 8: Order History ──────────────────────────────────────────────

export interface StatusHistoryEntry {
  status: string;
  changed_by: string;
  changed_at: string;
}

export interface OrderListItem {
  order_id: string;
  vendor: string;
  location_name: string;
  status: "aprobado" | "enviado" | "parcial" | "recibido";
  item_count: number;
  created_by: string;
  created_at: string;
  status_history: StatusHistoryEntry[];
}

export interface OrderHistoryFilters {
  vendor: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  sku: string;
}

export interface StatusTransitionRequest {
  status: string;
  changed_by: string;
}

export interface StatusTransitionResponse {
  status: string;
  changed_at: string;
}

export interface SingleExportResponse {
  excel_base64: string;
  filename: string;
}

// ─── Cache Status ────────────────────────────────────────────────────────

export interface CacheLocationStatus {
  age_hours: number | null;
  sku_count: number;
  fresh: boolean;
  cached_at: string;
}

export interface CacheStatusResponse {
  inventory: Record<string, CacheLocationStatus>;
  sales: {
    age_hours: number | null;
    sku_count: number;
    fresh: boolean;
    last_refreshed: string | null;
  };
  scheduler_running: boolean;
}
