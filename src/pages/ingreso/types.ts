export const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

export const MAIN_WAREHOUSES = [
  "Bukz Bogota 109",
  "Bukz Las Lomas",
  "Bukz Museo de Antioquia",
  "Bukz Viva Envigado",
  "Cedi Lomas",
  "Reserva B2B",
] as const;

// Fallback si el endpoint /locations falla — solo las principales
export const FALLBACK_WAREHOUSES = [...MAIN_WAREHOUSES];

export interface ProductSearchResult {
  ISBN: string;
  ID: string | null;
  "Variant ID": string | null;
  Titulo: string;
  Vendor: string;
  Precio: string | number | null;
  Categoria: string | null;
  Cantidad: number | null;
}

export interface LocationItem {
  name: string;
  id: number;
}

export interface SalesLoadResponse {
  success: boolean;
  message: string;
}

export interface ShopifyCreateResult {
  sku: string;
  title: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  shopify_id?: string;
  published?: boolean;
}

export interface ShopifyCreateResponse {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  results: ShopifyCreateResult[];
}

export interface SalesStatusResponse {
  cache: {
    loaded: boolean;
    skus_count: number;
    loaded_at: string | null;
  };
  job: {
    running: boolean;
    error: string | null;
  };
  bulk_operation: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Update Products
// ---------------------------------------------------------------------------

export interface UpdateFieldDiff {
  field: string;
  current: string;
  new: string;
}

export interface UpdateProductPreview {
  sku: string;
  title: string;
  product_id: string;
  variant_id: string;
  fields: UpdateFieldDiff[];
}

export interface UpdatePreviewResponse {
  total: number;
  found: number;
  not_found: number;
  changes: number;
  no_changes: number;
  preview: UpdateProductPreview[];
  not_found_skus: string[];
}

export interface UpdateApplyResult {
  sku: string;
  title: string;
  success: boolean;
  fields_updated?: string[];
  error?: string;
}

export interface UpdateApplyResponse {
  total: number;
  updated: number;
  failed: number;
  results: UpdateApplyResult[];
}

// ---------------------------------------------------------------------------
// Inline Update (from search table)
// ---------------------------------------------------------------------------

export interface InlineUpdateItem {
  sku: string;
  changes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Search Job (async polling)
// ---------------------------------------------------------------------------

export interface SearchJobStartResponse {
  job_id: string;
  total: number;
}

export interface SearchJobStatusResponse {
  status: "running" | "done" | "error";
  total: number;
  found: number;
  error: string | null;
}
