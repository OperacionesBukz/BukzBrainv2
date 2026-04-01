import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type {
  Vendor,
  CmvHistoryRecord,
  CmvState,
  CmvProduct,
  VendorBreakdown,
} from "./types";
import { INITIAL_CMV_STATE } from "./types";
import { processCmv, calculateTotals, recalculateProduct } from "./processing";

// --- Hook: Vendors (lee proveedores del Directorio) ---

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "directory"),
      where("type", "==", "proveedor")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs
          .filter((d) => d.data().estado === "Activo")
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: (data.empresa as string) || "",
              margin: ((data.margen as number) || 0) / 100,
              updatedAt: data.updatedAt,
            } as Vendor;
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setVendors(mapped);
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando proveedores del directorio:", err);
        toast.error("Error al cargar proveedores");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { vendors, loading };
}

// --- Hook: SKU → Vendor (desde inventory_cache de reposiciones) ---

export function useSkuVendorMap() {
  const [skuVendorMap, setSkuVendorMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInventoryCache() {
      try {
        const snap = await getDocs(collection(db, "inventory_cache"));
        const map = new Map<string, string>();

        for (const docSnap of snap.docs) {
          const data = docSnap.data();

          // Datos inline (no chunked)
          if (!data.chunked && Array.isArray(data.data)) {
            for (const item of data.data) {
              if (item.sku && item.vendor) {
                map.set(item.sku.trim(), item.vendor);
              }
            }
          }

          // Datos chunked — leer subcollection
          if (data.chunked) {
            const chunksSnap = await getDocs(
              collection(db, "inventory_cache", docSnap.id, "chunks")
            );
            for (const chunkDoc of chunksSnap.docs) {
              const chunkData = chunkDoc.data().data;
              if (Array.isArray(chunkData)) {
                for (const item of chunkData) {
                  if (item.sku && item.vendor) {
                    map.set(item.sku.trim(), item.vendor);
                  }
                }
              }
            }
          }
        }

        if (!cancelled) {
          setSkuVendorMap(map);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error cargando inventory_cache:", err);
        if (!cancelled) {
          toast.error("Error al cargar mapeo SKU→Vendor del inventario");
          setLoading(false);
        }
      }
    }

    loadInventoryCache();
    return () => { cancelled = true; };
  }, []);

  return { skuVendorMap, loading };
}

// --- Hook: Historial CMV ---

export function useCmvHistory() {
  const [history, setHistory] = useState<CmvHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "cmv_history"), orderBy("processedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setHistory(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as CmvHistoryRecord))
        );
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando historial:", err);
        toast.error("Error al cargar historial CMV");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const saveToHistory = async (
    month: number,
    year: number,
    products: CmvProduct[],
    processedBy: string
  ) => {
    const totals = calculateTotals(products);

    // Agrupar por vendor
    const vendorMap = new Map<string, VendorBreakdown>();
    for (const p of products) {
      const key = p.vendor || "Sin Vendor";
      const existing = vendorMap.get(key) || { vendor: key, ventas: 0, costo: 0, items: 0, margen: 0 };
      existing.ventas += p.valorTotal;
      existing.costo += p.costoTotal;
      existing.items += 1;
      vendorMap.set(key, existing);
    }

    const vendorBreakdown = Array.from(vendorMap.values()).map((v) => ({
      ...v,
      margen: v.ventas > 0 ? Math.round(((v.ventas - v.costo) / v.ventas) * 1000) / 10 : 0,
    }));

    await addDoc(collection(db, "cmv_history"), {
      month,
      year,
      totalVentas: totals.totalVentas,
      totalCosto: totals.totalCosto,
      margenPromedio: totals.margenPromedio,
      totalProductos: totals.totalProductos,
      vendorBreakdown,
      processedAt: serverTimestamp(),
      processedBy,
    });

    toast.success(`CMV de ${month}/${year} guardado en historial`);
  };

  return { history, loading, saveToHistory };
}

// --- Hook: Procesador CMV (estado del wizard) ---

export function useCmvProcessor() {
  const [state, setState] = useState<CmvState>(INITIAL_CMV_STATE);
  const { user } = useAuth();
  const { vendors, loading: vendorsLoading } = useVendors();
  const { skuVendorMap, loading: skuMapLoading } = useSkuVendorMap();
  const dataReady = !vendorsLoading && !skuMapLoading;

  const setSalesFile = useCallback((file: File | null) => {
    setState((s) => ({ ...s, salesFile: file }));
  }, []);

  const setNotesFile = useCallback((file: File | null) => {
    setState((s) => ({ ...s, notesFile: file }));
  }, []);

  const process = useCallback(async () => {
    if (!state.salesFile) {
      toast.error("Debes subir el archivo de ventas");
      return;
    }

    setState((s) => ({ ...s, isProcessing: true, error: null, step: "processing" }));

    try {
      const salesBuffer = await state.salesFile.arrayBuffer();
      const notesBuffer = state.notesFile ? await state.notesFile.arrayBuffer() : null;

      const result = await processCmv(salesBuffer, notesBuffer, vendors, skuVendorMap);

      const hasExceptions = result.unknownVendorProducts.length > 0 || result.missingMarginProducts.length > 0;

      setState((s) => ({
        ...s,
        products: result.products,
        unknownVendorProducts: result.unknownVendorProducts,
        missingMarginProducts: result.missingMarginProducts,
        stats: result.stats,
        totals: result.totals,
        isProcessing: false,
        step: hasExceptions ? "review" : "results",
      }));

      if (hasExceptions) {
        toast.warning(
          `Procesado con ${result.unknownVendorProducts.length + result.missingMarginProducts.length} excepciones por resolver`
        );
      } else {
        toast.success("CMV procesado exitosamente");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setState((s) => ({ ...s, isProcessing: false, error: message, step: "upload" }));
      toast.error(`Error al procesar: ${message}`);
    }
  }, [state.salesFile, state.notesFile, vendors, skuVendorMap]);

  // Resolver excepciones: asignar vendor a productos desconocidos
  const resolveVendorException = useCallback(
    (isbn: string, vendorName: string) => {
      setState((s) => {
        const vendor = vendors.find((v) => v.name.toUpperCase() === vendorName.toUpperCase());
        const margin = vendor?.margin || 0;

        const resolved: CmvProduct[] = [];
        const stillUnknown: CmvProduct[] = [];
        const movedToMissing: CmvProduct[] = [];

        for (const p of s.unknownVendorProducts) {
          if (p.isbn === isbn) {
            if (margin > 0) {
              resolved.push(recalculateProduct(p, vendorName, margin));
            } else {
              // Tiene vendor pero sin margen — mover a missingMarginProducts
              movedToMissing.push({ ...p, vendor: vendorName });
            }
          } else {
            stillUnknown.push(p);
          }
        }

        const newProducts = [...s.products, ...resolved];
        const newMissingMargins = [...s.missingMarginProducts, ...movedToMissing];

        return {
          ...s,
          products: newProducts,
          unknownVendorProducts: stillUnknown,
          missingMarginProducts: newMissingMargins,
          totals: calculateTotals(newProducts),
          stats: {
            ...s.stats,
            unknownVendors: stillUnknown.length,
            missingMargins: newMissingMargins.length,
          },
        };
      });
    },
    [vendors]
  );

  // Resolver excepciones: asignar margen a vendor sin margen
  const resolveMarginException = useCallback((vendorName: string, margin: number) => {
    setState((s) => {
      const resolved: CmvProduct[] = [];
      const stillMissing: CmvProduct[] = [];

      for (const p of s.missingMarginProducts) {
        if (p.vendor.toUpperCase() === vendorName.toUpperCase()) {
          resolved.push(recalculateProduct(p, p.vendor, margin));
        } else {
          stillMissing.push(p);
        }
      }

      const newProducts = [...s.products, ...resolved];

      return {
        ...s,
        products: newProducts,
        missingMarginProducts: stillMissing,
        totals: calculateTotals(newProducts),
        stats: { ...s.stats, missingMargins: stillMissing.length },
      };
    });
  }, []);

  // Finalizar revisión y pasar a resultados
  const finishReview = useCallback(() => {
    setState((s) => ({ ...s, step: "results" }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_CMV_STATE);
  }, []);

  const goToStep = useCallback((step: CmvState["step"]) => {
    setState((s) => ({ ...s, step }));
  }, []);

  return {
    state,
    setSalesFile,
    setNotesFile,
    process,
    resolveVendorException,
    resolveMarginException,
    finishReview,
    reset,
    goToStep,
    userEmail: user?.email || "",
    dataReady,
  };
}
