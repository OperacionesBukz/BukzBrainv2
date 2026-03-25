import { Timestamp } from "firebase/firestore";

export type DirectoryType = "empleado" | "temporal" | "proveedor";
export type DirectoryStatus = "Activo" | "Inactivo";

export const DIRECTORY_STATUSES: DirectoryStatus[] = ["Activo", "Inactivo"];

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
}

export interface SupplierEntry extends DirectoryBase {
  type: "proveedor";
  empresa: string;
  razonSocial: string;
  nit: string;
  margen: number;
}

export type DirectoryEntry = PersonEntry | SupplierEntry;

export function isPerson(e: DirectoryEntry): e is PersonEntry {
  return e.type === "empleado" || e.type === "temporal";
}

export function isSupplier(e: DirectoryEntry): e is SupplierEntry {
  return e.type === "proveedor";
}
