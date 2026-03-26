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
