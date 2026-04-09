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
import { getLocations, conciliar } from "./api";
import type { ConciliacionParams, ConciliacionLog } from "./types";

export function useLocations() {
  return useQuery({
    queryKey: ["conciliacion-ferias", "locations"],
    queryFn: getLocations,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useConciliar() {
  return useMutation({
    mutationFn: (params: ConciliacionParams) => conciliar(params),
  });
}

export function useConciliacionLog(maxDocs = 30) {
  const [logs, setLogs] = useState<(ConciliacionLog & { id: string })[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "conciliacion_ferias_log"),
      orderBy("creadoEn", "desc"),
      limit(maxDocs),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as ConciliacionLog),
        }));
        setLogs(data);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Error en listener conciliacion_ferias_log:",
          error,
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [maxDocs]);

  return { logs, loading };
}
