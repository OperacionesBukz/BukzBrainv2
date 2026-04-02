import type { Timestamp } from "firebase/firestore";

// --- Registros crudos del Excel ---

/** Registro crudo del Excel "Movimiento ventas y compras" */
export interface RawSaleRecord {
  [key: string]: unknown;
}

/** Nota crédito del Excel "Notas crédito/débito" */
export interface CreditNote {
  comprobanteRelacionado: string;
  tipo: string;
  valor: number;
}

// --- Producto procesado ---

export type DiscountType = "BUKZ" | "PROVEEDOR" | "COMFAMA" | "VACIO";

/** Producto después de procesar las 24 columnas finales */
export interface CmvProduct {
  factura: string;
  fecha: string;
  tercero: string;
  terceroNombre: string;
  bodega: string;
  concepto: string;
  isbn: string;
  producto: string;
  cantidad: number;
  valorUnitario: number;
  descuentoPct: number;
  valorTotal: number;
  observaciones: string;
  pedido: string;
  numeroPedido: string;
  descuento: DiscountType;
  formaPago: string;
  tipoDocumento: string;
  secuencia: string;
  tipoItem: string;
  vendor: string;
  margen: number;
  costo: number;
  costoTotal: number;
  discountCode: string;
}

// --- Firestore: Vendors y márgenes ---

export interface Vendor {
  id: string;
  name: string;
  margin: number;
  updatedAt: Timestamp;
}

// --- Firestore: Historial CMV ---

export interface VendorBreakdown {
  vendor: string;
  ventas: number;
  costo: number;
  items: number;
  margen: number;
}

export interface CmvHistoryRecord {
  id: string;
  month: number;
  year: number;
  totalVentas: number;
  totalCosto: number;
  margenPromedio: number;
  totalProductos: number;
  vendorBreakdown: VendorBreakdown[];
  processedAt: Timestamp;
  processedBy: string;
}

// --- Estado del procesamiento ---

export interface ProcessingStats {
  totalRawRecords: number;
  removedByNotes: number;
  removedPayments: number;
  removedServices: number;
  totalProducts: number;
  unknownVendors: number;
}

export interface CmvTotals {
  totalVentas: number;
  totalCosto: number;
  margenPromedio: number;
  costoPctVentas: number;
  totalProductos: number;
}

export type WizardStep = "upload" | "processing" | "review" | "results";

export interface CmvState {
  step: WizardStep;
  salesFile: File | null;
  notesFile: File | null;
  products: CmvProduct[];
  unknownVendorProducts: CmvProduct[];
  stats: ProcessingStats;
  totals: CmvTotals;
  isProcessing: boolean;
  error: string | null;
}

export const INITIAL_CMV_STATE: CmvState = {
  step: "upload",
  salesFile: null,
  notesFile: null,
  products: [],
  unknownVendorProducts: [],
  stats: {
    totalRawRecords: 0,
    removedByNotes: 0,
    removedPayments: 0,
    removedServices: 0,
    totalProducts: 0,
    unknownVendors: 0,
  },
  totals: {
    totalVentas: 0,
    totalCosto: 0,
    margenPromedio: 0,
    costoPctVentas: 0,
    totalProductos: 0,
  },
  isProcessing: false,
  error: null,
};
