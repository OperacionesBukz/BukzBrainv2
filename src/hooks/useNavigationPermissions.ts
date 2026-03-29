import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_PAGE_PATHS } from "@/lib/pages";
import type { WorkspaceId } from "@/lib/workspaces";

export { ALL_PAGE_PATHS };

type PageMap = Record<string, boolean>;
type WorkspaceMap = Record<string, boolean>;
type NavOrderMap = Record<string, string[]>;

// Sub-rutas agrupadas bajo /workflow que aún existen como permisos individuales en Firestore
const WORKFLOW_SUB_PATHS = ["/ingreso", "/crear-productos", "/actualizar-productos", "/scrap", "/cortes", "/envio-cortes", "/devoluciones", "/gift-cards"];

export function useNavigationPermissions() {
  const { user } = useAuth();
  const [allowedPages, setAllowedPages] = useState<Set<string>>(
    new Set(ALL_PAGE_PATHS)
  );
  const [allowedWorkspaces, setAllowedWorkspaces] = useState<Set<WorkspaceId>>(
    new Set(["general"])
  );
  const [navOrder, setNavOrder] = useState<NavOrderMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.email) {
      setAllowedPages(new Set(ALL_PAGE_PATHS));
      setAllowedWorkspaces(new Set(["general"]));
      setNavOrder({});
      return;
    }

    // Local mutable state shared between both listeners via closure
    let userPages: PageMap | null = null;
    let defaultPages: PageMap | null = null;
    let userWorkspaces: WorkspaceMap | null = null;
    let defaultWorkspaces: WorkspaceMap | null = null;
    let userNavOrder: NavOrderMap = {};

    const compute = () => {
      // Pages: user-specific config takes priority; fall back to default; fall back to show all
      const pages = userPages ?? defaultPages;
      if (!pages) {
        setAllowedPages(new Set([...ALL_PAGE_PATHS, ...WORKFLOW_SUB_PATHS]));
      } else {
        const allowed = new Set(ALL_PAGE_PATHS.filter((p) => pages[p] !== false));
        // Incluir sub-rutas de workflow que el usuario tenga permitidas
        for (const sub of WORKFLOW_SUB_PATHS) {
          if (pages[sub] !== false) allowed.add(sub);
        }
        // /workflow es visible si al menos una sub-ruta está permitida
        if (WORKFLOW_SUB_PATHS.some((p) => allowed.has(p))) {
          allowed.add("/workflow");
        } else {
          allowed.delete("/workflow");
        }
        setAllowedPages(allowed);
      }

      // Workspaces: user-specific takes priority; fall back to default; fall back to general only
      const workspaces = userWorkspaces ?? defaultWorkspaces;
      if (!workspaces) {
        setAllowedWorkspaces(new Set(["general"]));
      } else {
        const allowed = new Set<WorkspaceId>(["general"]); // general is always enabled
        if (workspaces["operaciones"] === true) {
          allowed.add("operaciones");
        }
        setAllowedWorkspaces(allowed);
      }

      setNavOrder({ ...userNavOrder });
      setLoaded(true);
    };

    const unsubUser = onSnapshot(
      doc(db, "navigation_permissions", user.email),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          userPages = (data?.pages as PageMap) ?? null;
          userWorkspaces = (data?.workspaces as WorkspaceMap) ?? null;
          userNavOrder = {};
          if (Array.isArray(data?.navOrder_general)) userNavOrder.general = data.navOrder_general;
          if (Array.isArray(data?.navOrder_operaciones)) userNavOrder.operaciones = data.navOrder_operaciones;
        } else {
          userPages = null;
          userWorkspaces = null;
          userNavOrder = {};
        }
        compute();
      },
      (error) => {
        console.warn("[nav-permissions] Error en listener usuario:", error.message);
        setAllowedPages(new Set([...ALL_PAGE_PATHS, ...WORKFLOW_SUB_PATHS]));
        setAllowedWorkspaces(new Set<WorkspaceId>(["general", "operaciones"]));
        setLoaded(true);
      },
    );

    const unsubDefault = onSnapshot(
      doc(db, "navigation_permissions", "_default"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          defaultPages = (data?.pages as PageMap) ?? null;
          defaultWorkspaces = (data?.workspaces as WorkspaceMap) ?? null;
        } else {
          defaultPages = null;
          defaultWorkspaces = null;
        }
        compute();
      },
      (error) => {
        console.warn("[nav-permissions] Error en listener default:", error.message);
        setLoaded(true);
      },
    );

    return () => {
      unsubUser();
      unsubDefault();
    };
  }, [user?.email]);

  const updateNavOrder = useCallback(async (workspaceId: string, paths: string[]) => {
    if (!user?.email) return;
    const ref = doc(db, "navigation_permissions", user.email);
    await setDoc(ref, { [`navOrder_${workspaceId}`]: paths }, { merge: true });
  }, [user?.email]);

  return { allowedPages, allowedWorkspaces, navOrder, updateNavOrder, loaded };
}
