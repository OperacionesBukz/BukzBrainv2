export { API_BASE } from "../../ingreso/types";

export interface CortesRow {
  orderName: string;
  sku: string;
  productTitle: string;
  vendor: string;
  posLocation: string;
  salesChannel: string;
  discountName: string;
  netItemsSold: number;
  detalle: string;
  udsConDescuento: number;
}

export interface DescuentoRow {
  orderName: string;
  sku: string;
  productTitle: string;
  vendor: string;
  discountName: string;
  netItemsSold: number;
  pctEsperado: number;
  pctReal: number;
  detalle: string;
}
