import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { PAGE_REGISTRY } from "@/lib/pages";
import { resilientFetch } from "@/lib/resilient-fetch";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

const RECENTS_KEY = "bukz-search-recents";
const FREQ_KEY = "bukz-search-freq";
const MAX_RECENTS = 8;
const MAX_FREQ = 5;
const DEBOUNCE_MS = 300;

export interface SearchResult {
  id: string;
  type: "page" | "product" | "task" | "directory" | "devolucion";
  title: string;
  subtitle: string;
  path: string;
}

// ─── localStorage helpers ───

function loadRecents(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecents(items: SearchResult[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, MAX_RECENTS)));
}

function loadFrequent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FREQ_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFrequent(map: Record<string, number>) {
  localStorage.setItem(FREQ_KEY, JSON.stringify(map));
}

export function recordSelection(item: SearchResult) {
  // Update recents
  const recents = loadRecents().filter((r) => r.id !== item.id);
  recents.unshift(item);
  saveRecents(recents);

  // Update frequency
  const freq = loadFrequent();
  freq[item.id] = (freq[item.id] || 0) + 1;
  saveFrequent(freq);
}

export function getRecents(): SearchResult[] {
  return loadRecents();
}

export function getFrequent(): SearchResult[] {
  const freq = loadFrequent();
  const recents = loadRecents();
  const allItems = new Map<string, SearchResult>();
  for (const r of recents) allItems.set(r.id, r);

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FREQ)
    .map(([id]) => allItems.get(id))
    .filter(Boolean) as SearchResult[];
}

// ─── Firestore data cache ───

let tasksCache: SearchResult[] | null = null;
let directoryCache: SearchResult[] | null = null;
let devolucionesCache: SearchResult[] | null = null;

async function fetchTasks(userId: string): Promise<SearchResult[]> {
  if (tasksCache) return tasksCache;
  const results: SearchResult[] = [];
  try {
    // Team tasks
    const teamSnap = await getDocs(
      query(collection(db, "tasks"), orderBy("createdAt", "desc"), limit(100))
    );
    for (const doc of teamSnap.docs) {
      const d = doc.data();
      results.push({
        id: `task-${doc.id}`,
        type: "task",
        title: d.title || "Sin título",
        subtitle: d.department || d.status || "",
        path: "/operations",
      });
    }
    // Personal tasks
    const personalSnap = await getDocs(
      query(
        collection(db, "user_tasks"),
        where("userId", "==", userId),
        limit(50)
      )
    );
    for (const doc of personalSnap.docs) {
      const d = doc.data();
      results.push({
        id: `utask-${doc.id}`,
        type: "task",
        title: d.title || d.text || "Sin título",
        subtitle: "Tarea personal",
        path: "/tasks",
      });
    }
  } catch (e) {
    console.warn("[GlobalSearch] Error fetching tasks:", e);
  }
  tasksCache = results;
  // Invalidate cache after 2 minutes
  setTimeout(() => {
    tasksCache = null;
  }, 120_000);
  return results;
}

async function fetchDirectory(): Promise<SearchResult[]> {
  if (directoryCache) return directoryCache;
  const results: SearchResult[] = [];
  try {
    const snap = await getDocs(collection(db, "directory"));
    for (const doc of snap.docs) {
      const d = doc.data();
      const name =
        d.name || d.nombre || `${d.firstName || ""} ${d.lastName || ""}`.trim();
      results.push({
        id: `dir-${doc.id}`,
        type: "directory",
        title: name || "Sin nombre",
        subtitle: d.role || d.cargo || d.position || d.type || "",
        path: "/directorio",
      });
    }
  } catch (e) {
    console.warn("[GlobalSearch] Error fetching directory:", e);
  }
  directoryCache = results;
  setTimeout(() => {
    directoryCache = null;
  }, 120_000);
  return results;
}

async function fetchDevoluciones(): Promise<SearchResult[]> {
  if (devolucionesCache) return devolucionesCache;
  const results: SearchResult[] = [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "devoluciones_log"),
        orderBy("creadoEn", "desc"),
        limit(50)
      )
    );
    for (const doc of snap.docs) {
      const d = doc.data();
      results.push({
        id: `dev-${doc.id}`,
        type: "devolucion",
        title: d.codigoDevolucion || doc.id,
        subtitle: d.destinatario || d.tipo || "",
        path: "/workflow/devoluciones/historial",
      });
    }
  } catch (e) {
    console.warn("[GlobalSearch] Error fetching devoluciones:", e);
  }
  devolucionesCache = results;
  setTimeout(() => {
    devolucionesCache = null;
  }, 120_000);
  return results;
}

// ─── Product search (backend) ───

async function searchProducts(term: string): Promise<SearchResult[]> {
  try {
    const res = await resilientFetch(
      `${API_BASE}/api/search/products?q=${encodeURIComponent(term)}&limit=5`,
      { timeout: 5000 }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: any) => ({
      id: `prod-${p.sku}`,
      type: "product" as const,
      title: p.title,
      subtitle: [p.vendor, p.category].filter(Boolean).join(" · "),
      path: `/workflow/scrap?isbn=${p.sku}`,
    }));
  } catch {
    return [];
  }
}

// ─── Main hook ───

export function useGlobalSearch() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [productResults, setProductResults] = useState<SearchResult[]>([]);
  const [firestoreData, setFirestoreData] = useState<{
    tasks: SearchResult[];
    directory: SearchResult[];
    devoluciones: SearchResult[];
  }>({ tasks: [], directory: [], devoluciones: [] });
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingFirestore, setLoadingFirestore] = useState(false);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Firestore data once when hook mounts (or user changes)
  useEffect(() => {
    if (!user?.uid) return;
    // Invalidar caches al cambiar de usuario para evitar datos cruzados
    tasksCache = null;
    directoryCache = null;
    devolucionesCache = null;
    let cancelled = false;
    setLoadingFirestore(true);
    Promise.all([
      fetchTasks(user.uid),
      fetchDirectory(),
      fetchDevoluciones(),
    ]).then(([tasks, directory, devoluciones]) => {
      if (!cancelled) {
        setFirestoreData({ tasks, directory, devoluciones });
        setLoadingFirestore(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Search products on backend when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setProductResults([]);
      return;
    }
    let cancelled = false;
    setLoadingProducts(true);
    searchProducts(debouncedQuery).then((results) => {
      if (!cancelled) {
        setProductResults(results);
        setLoadingProducts(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Filter local results
  const filteredResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return { pages: [], tasks: [], directory: [], devoluciones: [] };

    const filterFn = (items: SearchResult[]) =>
      items
        .filter(
          (item) =>
            item.title.toLowerCase().includes(term) ||
            item.subtitle.toLowerCase().includes(term)
        )
        .slice(0, 5);

    return {
      pages: PAGE_REGISTRY.filter(
        (p) =>
          p.label.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      )
        .slice(0, 5)
        .map((p) => ({
          id: `page-${p.path}`,
          type: "page" as const,
          title: p.label,
          subtitle: p.description,
          path: p.path,
        })),
      tasks: filterFn(firestoreData.tasks),
      directory: filterFn(firestoreData.directory),
      devoluciones: filterFn(firestoreData.devoluciones),
    };
  }, [searchQuery, firestoreData]);

  const hasResults =
    searchQuery.trim().length > 0 &&
    (filteredResults.pages.length > 0 ||
      productResults.length > 0 ||
      filteredResults.tasks.length > 0 ||
      filteredResults.directory.length > 0 ||
      filteredResults.devoluciones.length > 0);

  return {
    searchQuery,
    setSearchQuery,
    filteredResults,
    productResults,
    loadingProducts,
    loadingFirestore,
    hasResults,
  };
}
