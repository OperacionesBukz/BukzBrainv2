export { API_BASE } from "../ingreso/types";

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export interface EnvioResultado {
  proveedor: string;
  correo: string;
  estado: "enviado" | "error" | "sin_correo";
  detalle: string;
}

export interface EnvioResumen {
  enviados: number;
  errores: number;
  sin_correo: number;
}

export interface VentasResponse {
  resultados: EnvioResultado[];
  resumen: EnvioResumen;
  zip_base64: string;
}

export interface NoVentasResponse {
  resultados: EnvioResultado[];
  resumen: EnvioResumen;
}
