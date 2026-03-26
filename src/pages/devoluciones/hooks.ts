import { useQuery, useMutation } from "@tanstack/react-query";
import { getConfig, enviarSedes, enviarProveedores } from "./api";

export function useDevolucionesConfig() {
  return useQuery({
    queryKey: ["devoluciones", "config"],
    queryFn: getConfig,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useEnviarSedes() {
  return useMutation({
    mutationFn: (params: {
      sede: string;
      motivo: string;
      proveedorNombre: string;
      archivo: File;
      remitente: string;
    }) =>
      enviarSedes(
        params.sede,
        params.motivo,
        params.proveedorNombre,
        params.archivo,
        params.remitente,
      ),
  });
}

export function useEnviarProveedores() {
  return useMutation({
    mutationFn: (params: {
      proveedor: string;
      motivo: string;
      ciudad: string;
      numCajas: number;
      archivo: File;
      remitente: string;
    }) =>
      enviarProveedores(
        params.proveedor,
        params.motivo,
        params.ciudad,
        params.numCajas,
        params.archivo,
        params.remitente,
      ),
  });
}
