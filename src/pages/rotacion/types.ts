export interface SedeRotacion {
  sede: string;
  inventario_unidades: number;
  inventario_skus: number;
  vendidas_unidades: number;
  vendidas_skus: number;
  rotacion: number | null;
  dias_inventario: number | null;
  venta_diaria: number;
  sell_through_pct: number | null;
  semaforo: "verde" | "amarillo" | "rojo";
}

export interface TurnoverTotals {
  inventario_unidades: number;
  vendidas_unidades: number;
  rotacion: number | null;
  dias_inventario: number | null;
  venta_diaria: number;
  sell_through_pct: number | null;
  semaforo: "verde" | "amarillo" | "rojo";
}

export interface TurnoverResult {
  periodo_meses: number;
  fecha_calculo: string;
  sedes: SedeRotacion[];
  totales: TurnoverTotals;
}

export interface TurnoverStatus {
  running: boolean;
  phase: string | null;
  error: string | null;
  started_at: string | null;
  result: TurnoverResult | null;
}

export interface InventoryPreview {
  sede: string;
  inventario_unidades: number;
}
