import type { Timestamp } from "firebase/firestore";

export { API_BASE } from "../ingreso/types";

export interface LocationOption {
  name: string;
  id: string;
}

export interface ConciliacionParams {
  location_name: string;
  location_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  file_enviado: File;
  file_devuelto: File;
}

export interface ConciliacionItem {
  sku: string;
  titulo: string;
  enviado: number;
  devuelto: number;
  vendido: number;
  diferencia: number;
  estado: "ok" | "faltante" | "sobrante";
}

export interface ConciliacionResumen {
  location: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_enviado: number;
  total_devuelto: number;
  total_vendido: number;
  total_diferencia: number;
  total_skus: number;
  skus_ok: number;
  skus_faltante: number;
  skus_sobrante: number;
}

export interface ConciliacionResponse {
  resumen: ConciliacionResumen;
  items: ConciliacionItem[];
  archivo_enviado: string;
  archivo_devuelto: string;
}

export interface ConciliacionLog {
  feriaLocation: string;
  feriaLocationId: string;
  fechaInicio: string;
  fechaFin: string;
  totalEnviado: number;
  totalDevuelto: number;
  totalVendido: number;
  totalDiferencia: number;
  skusConDiferencia: number;
  totalSkus: number;
  realizadoPor: string;
  realizadoPorNombre: string;
  creadoEn: Timestamp;
}
