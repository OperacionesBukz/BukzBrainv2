export const API_BASE =
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
  skus_count: number;
  loaded_at: string;
}

export interface SalesStatusResponse {
  cache: {
    loaded: boolean;
    skus_count: number;
    loaded_at: string | null;
  };
  bulk_operation: Record<string, unknown>;
}
