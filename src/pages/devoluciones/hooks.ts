import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getConfig, enviarSedes, enviarProveedores } from "./api";
import type { DevolucionLog } from "./types";

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

export function useDevolucionesLog(maxDocs = 50) {
  const [logs, setLogs] = useState<(DevolucionLog & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "devoluciones_log"),
      orderBy("creadoEn", "desc"),
      limit(maxDocs),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as DevolucionLog),
        }));
        setLogs(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error en listener devoluciones_log:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [maxDocs]);

  return { logs, loading };
}
