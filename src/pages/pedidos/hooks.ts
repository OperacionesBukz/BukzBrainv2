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
import { getConfig, enviarPedidoSede, enviarPedidoCiudad } from "./api";
import type { PedidoLog } from "./types";

export function usePedidosConfig() {
  return useQuery({
    queryKey: ["pedidos", "config"],
    queryFn: getConfig,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useEnviarPedidoSede() {
  return useMutation({
    mutationFn: (params: {
      proveedor: string;
      sede: string;
      tipo: string;
      mes: string;
      anio: string;
      remitente: string;
      archivo: File;
    }) =>
      enviarPedidoSede(
        params.proveedor,
        params.sede,
        params.tipo,
        params.mes,
        params.anio,
        params.remitente,
        params.archivo,
      ),
  });
}

export function useEnviarPedidoCiudad() {
  return useMutation({
    mutationFn: (params: {
      proveedor: string;
      ciudad: string;
      tipo: string;
      mes: string;
      anio: string;
      remitente: string;
      archivo: File;
    }) =>
      enviarPedidoCiudad(
        params.proveedor,
        params.ciudad,
        params.tipo,
        params.mes,
        params.anio,
        params.remitente,
        params.archivo,
      ),
  });
}

export function usePedidosLog(maxDocs = 50) {
  const [logs, setLogs] = useState<(PedidoLog & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "pedidos_log"),
      orderBy("creadoEn", "desc"),
      limit(maxDocs),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as PedidoLog),
        }));
        setLogs(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error en listener pedidos_log:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [maxDocs]);

  return { logs, loading };
}
