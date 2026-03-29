import { useMutation } from "@tanstack/react-query";
import { enviarCortesVentas, enviarCortesNoVentas, enviarCorteIndividual } from "./api";

export function useEnviarCortesVentas() {
  return useMutation({
    mutationFn: (params: {
      proveedoresFile: File;
      ventasFile: File;
      mes: string;
      anio: string;
      remitente: string;
    }) =>
      enviarCortesVentas(
        params.proveedoresFile,
        params.ventasFile,
        params.mes,
        params.anio,
        params.remitente,
      ),
  });
}

export function useEnviarCortesNoVentas() {
  return useMutation({
    mutationFn: (params: {
      proveedoresFile: File;
      estadoFile: File;
      mes: string;
      anio: string;
      remitente: string;
    }) =>
      enviarCortesNoVentas(
        params.proveedoresFile,
        params.estadoFile,
        params.mes,
        params.anio,
        params.remitente,
      ),
  });
}

export function useEnviarCorteIndividual() {
  return useMutation({
    mutationFn: (params: {
      ventasFile: File;
      proveedor: string;
      correo: string;
      correoCc: string;
      mes: string;
      anio: string;
      remitente: string;
    }) =>
      enviarCorteIndividual(
        params.ventasFile,
        params.proveedor,
        params.correo,
        params.correoCc,
        params.mes,
        params.anio,
        params.remitente,
      ),
  });
}
