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
