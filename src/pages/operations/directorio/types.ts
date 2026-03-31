import { Timestamp } from "firebase/firestore";

export type DirectoryType = "empleado" | "temporal" | "proveedor";
export type DirectoryStatus = "Activo" | "Inactivo";
export type PersonClasificacion = "Empleado" | "Temporal" | "Empleado Temporal";

export const DIRECTORY_STATUSES: DirectoryStatus[] = ["Activo", "Inactivo"];
export const PERSON_CLASIFICACIONES: PersonClasificacion[] = [
  "Empleado",
  "Temporal",
  "Empleado Temporal",
];

export const CLASIFICACION_CONFIG: Record<
  PersonClasificacion,
  { bg: string; text: string }
> = {
  Empleado: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
  },
  Temporal: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  "Empleado Temporal": {
    bg: "bg-purple-100 dark:bg-purple-900/40",
    text: "text-purple-700 dark:text-purple-300",
  },
};

export const STATUS_CONFIG: Record<
  DirectoryStatus,
  { label: string; bg: string; text: string }
> = {
  Activo: {
    label: "Activo",
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
  },
  Inactivo: {
    label: "Inactivo",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  },
};

export const TAB_LABELS: Record<DirectoryType, string> = {
  empleado: "Empleados",
  temporal: "Temporales",
  proveedor: "Proveedores",
};

interface DirectoryBase {
  id: string;
  type: DirectoryType;
  estado: DirectoryStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PersonEntry extends DirectoryBase {
  type: "empleado" | "temporal";
  nombre: string;
  apellido: string;
  cedula: string;
  celular: string;
  correo: string;
  clasificacion?: PersonClasificacion;
}

export interface ContactoComercial {
  nombre: string;
  correo: string;
  ciudad: string;
}

export interface SupplierEntry extends DirectoryBase {
  type: "proveedor";
  empresa: string;
  razonSocial: string;
  nit: string;
  margen: number;
  correo: string;           // Correo principal — usado para cortes
  correos_cc: string[];     // CC emails
  observaciones: string;
  contactos?: ContactoComercial[];  // Contactos comerciales por ciudad — usados para pedidos y devoluciones
}

export type DirectoryEntry = PersonEntry | SupplierEntry;

export function isPerson(e: DirectoryEntry): e is PersonEntry {
  return e.type === "empleado" || e.type === "temporal";
}

/** Returns clasificacion, falling back to type for legacy docs without the field */
export function getClasificacion(e: PersonEntry): PersonClasificacion {
  if (e.clasificacion) return e.clasificacion;
  return e.type === "empleado" ? "Empleado" : "Temporal";
}

/** Whether a person entry should appear in the given tab */
export function matchesTab(e: PersonEntry, tab: "empleado" | "temporal"): boolean {
  const c = getClasificacion(e);
  if (c === "Empleado Temporal") return true;
  return tab === "empleado" ? c === "Empleado" : c === "Temporal";
}

export function isSupplier(e: DirectoryEntry): e is SupplierEntry {
  return e.type === "proveedor";
}
