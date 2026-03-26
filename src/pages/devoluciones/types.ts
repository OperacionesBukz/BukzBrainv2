export { API_BASE } from "../ingreso/types";

export interface DevolucionesConfig {
  sedes: string[];
  motivos_sedes: string[];
  proveedores: string[];
  motivos_proveedores: string[];
  ciudades: string[];
}

export interface EnvioResponse {
  success: boolean;
  destinatario: string;
  correos: string[];
  asunto: string;
}

import type { Timestamp } from "firebase/firestore";

export interface DevolucionLog {
  tipo: "sede" | "proveedor";
  destinatario: string;
  correos: string[];
  motivo: string;
  ciudad?: string;
  numCajas?: number;
  proveedorNombre?: string;
  nombreArchivo: string;
  asunto: string;
  enviadoPor: string;
  enviadoPorNombre: string;
  estado: "enviado" | "error";
  detalle?: string;
  creadoEn: Timestamp;
}
