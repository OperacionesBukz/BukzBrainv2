import type { Timestamp } from "firebase/firestore";

export { API_BASE } from "../ingreso/types";

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

const currentYear = new Date().getFullYear();
export const ANIOS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(String);

export interface SedeInfo {
  direccion: string;
  horario: string;
}

export interface PedidosConfig {
  sedes: string[];
  sedes_info: Record<string, SedeInfo>;
  proveedores: string[];
  tipos: string[];
  meses: string[];
  ciudades: string[];
}

export interface PedidoResponse {
  success: boolean;
  proveedor: string;
  sede?: string;
  ciudad?: string;
  correos: string[];
  asunto: string;
}

export interface PedidoLog {
  tipo: "sede" | "ciudad";
  proveedor: string;
  destino: string;
  tipoPedido: string;
  mes: string;
  anio: string;
  correos: string[];
  nombreArchivo: string;
  asunto: string;
  enviadoPor: string;
  enviadoPorNombre: string;
  estado: "enviado" | "error";
  detalle?: string;
  creadoEn: Timestamp;
}
