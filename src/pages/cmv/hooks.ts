import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
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
import { parseExcelFiles, processCmvFromRecords, calculateTotals } from "./processing";
import { parseCompletedCmvExcel } from "./excel-utils";

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

// --- Lookup SKU → Vendor via backend (no carga 176K items en browser) ---

const API_BASE = import.meta.env.VITE_API_URL || "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

async function lookupVendorsBatch(skus: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (skus.length === 0) return map;

  try {
    const resp = await fetch(`${API_BASE}/api/reposiciones/catalog/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skus }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data: Record<string, string> = await resp.json();
    for (const [sku, vendor] of Object.entries(data)) {
      map.set(sku, vendor);
    }
  } catch (err) {
    console.error("Error en catalog lookup:", err);
    toast.error("Error al buscar vendors en el catálogo");
  }

  return map;
}

// --- Lookup Order → Discount Code via Shopify ---

async function lookupDiscountCodes(orderNames: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (orderNames.length === 0) return map;

  try {
    const resp = await fetch(`${API_BASE}/api/reposiciones/orders/discounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: orderNames }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data: Record<string, string> = await resp.json();
    for (const [order, code] of Object.entries(data)) {
      map.set(order, code);
    }
  } catch (err) {
    console.error("Error en discount lookup:", err);
    toast.error("Error al buscar descuentos en Shopify");
  }

  return map;
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

  const deleteFromHistory = async (id: string) => {
    await deleteDoc(doc(db, "cmv_history", id));
    toast.success("Registro eliminado del historial");
  };

  return { history, loading, saveToHistory, deleteFromHistory };
}

// --- Hook: Procesador CMV (estado del wizard) ---

export function useCmvProcessor() {
  const [state, setState] = useState<CmvState>(INITIAL_CMV_STATE);
  const { user } = useAuth();
  const dataReady = true;

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

      // 1. Parsear Excel UNA sola vez y extraer ISBNs únicos
      const { rawRecords, creditNotes, uniqueIsbns } = parseExcelFiles(salesBuffer, notesBuffer);
      console.log("[CMV] Parsed:", rawRecords.length, "records,", uniqueIsbns.length, "unique ISBNs");

      // 2. Lookup de vendors via backend (envía ~3K ISBNs, recibe ~3K vendors)
      const skuVendorMap = await lookupVendorsBatch(uniqueIsbns);
      console.log("[CMV] Lookup returned:", skuVendorMap.size, "vendors");

      // Validar que el catálogo retornó suficientes resultados
      const matchRate = uniqueIsbns.length > 0 ? skuVendorMap.size / uniqueIsbns.length : 1;
      if (matchRate < 0.8) {
        setState((s) => ({ ...s, isProcessing: false, step: "upload" }));
        toast.error(
          `El catálogo solo encontró ${skuVendorMap.size} de ${uniqueIsbns.length} SKUs (${Math.round(matchRate * 100)}%). Puede estar actualizándose. Intenta de nuevo en unos minutos.`
        );
        return;
      }

      // 3. Procesar con los datos ya parseados (sin márgenes)
      const result = processCmvFromRecords(rawRecords, creditNotes, skuVendorMap);
      console.log("[CMV] Result:", result.products.length, "assigned,", result.unknownVendorProducts.length, "unknown");

      // 4. Lookup de discount codes via Shopify (por número de pedido)
      const allProducts = [...result.products, ...result.unknownVendorProducts];
      const allPedidos = allProducts.map((p) => p.numeroPedido).filter(Boolean);
      const uniqueOrders = [...new Set(allPedidos.filter((n) => n.startsWith("#")))];
      console.log("[CMV] Pedidos encontrados:", allPedidos.length, "total,", uniqueOrders.length, "únicos con #");
      console.log("[CMV] Muestra de pedidos:", uniqueOrders.slice(0, 10));
      const discountMap = await lookupDiscountCodes(uniqueOrders);
      const withCodes = [...discountMap.entries()].filter(([, v]) => v !== "");
      console.log("[CMV] Discount lookup returned:", discountMap.size, "orders total,", withCodes.length, "with discount codes");
      console.log("[CMV] Has #186905?", discountMap.has("#186905"), "value:", discountMap.get("#186905"));

      // Asignar discount code de Shopify a cada producto
      const applyDiscounts = (products: typeof allProducts) =>
        products.map((p) => {
          const code = discountMap.get(p.numeroPedido) || "";
          return { ...p, discountCode: code };
        });

      const productsWithDiscounts = applyDiscounts(result.products);
      const unknownWithDiscounts = applyDiscounts(result.unknownVendorProducts);

      const hasExceptions = unknownWithDiscounts.length > 0;

      setState((s) => ({
        ...s,
        products: productsWithDiscounts,
        unknownVendorProducts: unknownWithDiscounts,
        stats: result.stats,
        totals: result.totals,
        isProcessing: false,
        step: hasExceptions ? "review" : "results",
      }));

      if (hasExceptions) {
        toast.warning(
          `Procesado con ${result.unknownVendorProducts.length} productos sin vendor por resolver`
        );
      } else {
        toast.success("CMV procesado exitosamente");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setState((s) => ({ ...s, isProcessing: false, error: message, step: "upload" }));
      toast.error(`Error al procesar: ${message}`);
    }
  }, [state.salesFile, state.notesFile]);

  // Resolver excepciones: asignar vendor a productos desconocidos
  const resolveVendorException = useCallback(
    (isbn: string, vendorName: string) => {
      setState((s) => {
        const resolved: CmvProduct[] = [];
        const stillUnknown: CmvProduct[] = [];

        for (const p of s.unknownVendorProducts) {
          if (p.isbn === isbn) {
            resolved.push({ ...p, vendor: vendorName });
          } else {
            stillUnknown.push(p);
          }
        }

        const newProducts = [...s.products, ...resolved];

        return {
          ...s,
          products: newProducts,
          unknownVendorProducts: stillUnknown,
          totals: calculateTotals(newProducts),
          stats: {
            ...s.stats,
            unknownVendors: stillUnknown.length,
          },
        };
      });
    },
    []
  );

  // Importar Excel CMV completado (con márgenes/costos llenados)
  const importCompleted = useCallback(async (file: File) => {
    setState((s) => ({ ...s, isProcessing: true, error: null, step: "processing" }));
    try {
      const buffer = await file.arrayBuffer();
      const products = parseCompletedCmvExcel(buffer);
      const totals = calculateTotals(products);

      setState((s) => ({
        ...s,
        products,
        unknownVendorProducts: [],
        stats: {
          totalRawRecords: products.length,
          removedByNotes: 0,
          removedPayments: 0,
          removedServices: 0,
          totalProducts: products.length,
          unknownVendors: 0,
        },
        totals,
        isProcessing: false,
        step: "results",
      }));

      toast.success(`CMV importado: ${products.length} productos`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setState((s) => ({ ...s, isProcessing: false, error: message, step: "upload" }));
      toast.error(`Error al importar: ${message}`);
    }
  }, []);

  // Finalizar revisión: incluir productos sin vendor en resultados y pasar a results
  const finishReview = useCallback(() => {
    setState((s) => {
      const allProducts = [...s.products, ...s.unknownVendorProducts];
      return {
        ...s,
        products: allProducts,
        unknownVendorProducts: [],
        totals: calculateTotals(allProducts),
        step: "results",
      };
    });
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
    importCompleted,
    resolveVendorException,
    finishReview,
    reset,
    goToStep,
    userEmail: user?.email || "",
    dataReady,
  };
}
