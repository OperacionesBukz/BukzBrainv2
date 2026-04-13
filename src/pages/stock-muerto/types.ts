export const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

export interface DeadStockConfig {
  vendor: string;
  days_without_sales: number;
  min_product_age_months: number;
}

export interface DeadStockResult {
  vendor: string;
  days_without_sales: number;
  min_product_age_months: number;
  total_variants_with_stock: number;
  total_units: number;
  dead_stock_variants: number;
  dead_stock_units: number;
  dead_stock_pct: number;
  excel_base64: string | null;
  fecha_calculo: string;
  message?: string;
}

export interface DeadStockStatus {
  running: boolean;
  phase: string | null;
  error: string | null;
  started_at: string | null;
  result: DeadStockResult | null;
}

export interface StartResponse {
  success: boolean;
  message?: string;
  error?: string;
}
