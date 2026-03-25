export const API_BASE =
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

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
