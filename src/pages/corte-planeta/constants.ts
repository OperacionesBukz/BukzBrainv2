export const BODEGA_TARGETS = [
  "Bukz Medellín",
  "Bukz Bogotá",
  "Bukz B2B Medellín",
] as const;

export type BodegaTarget = (typeof BODEGA_TARGETS)[number];

export const DEFAULT_BODEGA_MAPPINGS: Record<string, BodegaTarget> = {
  "Bukz Las Lomas": "Bukz Medellín",
  "Bukz Museo de Antioquia": "Bukz Medellín",
  "Bukz Viva Envigado": "Bukz Medellín",
  "Bukz Bogota 109": "Bukz Bogotá",
  "Reserva B2B": "Bukz B2B Medellín",
};

export const DEFAULT_RECIPIENTS = [
  "mromero@planeta.com.co",
  "ovargas@planeta.com.co",
];

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const LOCAL_STORAGE_KEY = "planeta-bodega-mappings";
