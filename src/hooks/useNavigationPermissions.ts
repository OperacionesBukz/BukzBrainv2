import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_PAGE_PATHS } from "@/lib/pages";
import type { WorkspaceId } from "@/lib/workspaces";

export { ALL_PAGE_PATHS };

type PageMap = Record<string, boolean>;
type WorkspaceMap = Record<string, boolean>;

export function useNavigationPermissions() {
  const { user } = useAuth();
  const [allowedPages, setAllowedPages] = useState<Set<string>>(
    new Set(ALL_PAGE_PATHS)
  );
  const [allowedWorkspaces, setAllowedWorkspaces] = useState<Set<WorkspaceId>>(
    new Set(["general"])
  );

  useEffect(() => {
    if (!user?.email) {
      setAllowedPages(new Set(ALL_PAGE_PATHS));
      setAllowedWorkspaces(new Set(["general"]));
      return;
    }

    // Local mutable state shared between both listeners via closure
    let userPages: PageMap | null = null;
    let defaultPages: PageMap | null = null;
    let userWorkspaces: WorkspaceMap | null = null;
    let defaultWorkspaces: WorkspaceMap | null = null;

    const compute = () => {
      // Pages: user-specific config takes priority; fall back to default; fall back to show all
      const pages = userPages ?? defaultPages;
      if (!pages) {
        setAllowedPages(new Set(ALL_PAGE_PATHS));
      } else {
        setAllowedPages(
          new Set(ALL_PAGE_PATHS.filter((p) => pages[p] !== false))
        );
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
    };

    const unsubUser = onSnapshot(
      doc(db, "navigation_permissions", user.email),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          userPages = (data?.pages as PageMap) ?? null;
          userWorkspaces = (data?.workspaces as WorkspaceMap) ?? null;
        } else {
          userPages = null;
          userWorkspaces = null;
        }
        compute();
      }
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
      }
    );

    return () => {
      unsubUser();
      unsubDefault();
    };
  }, [user?.email]);

  return { allowedPages, allowedWorkspaces };
}
