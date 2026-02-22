import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export const ALL_PAGE_PATHS = [
  "/dashboard",
  "/operations",
  "/tasks",
  "/instructions",
  "/requests",
  "/bookstore-requests",
];

type PageMap = Record<string, boolean>;

export function useNavigationPermissions() {
  const { user } = useAuth();
  const [allowedPages, setAllowedPages] = useState<Set<string>>(
    new Set(ALL_PAGE_PATHS)
  );

  useEffect(() => {
    if (!user?.email) {
      setAllowedPages(new Set(ALL_PAGE_PATHS));
      return;
    }

    // Local mutable state shared between both listeners via closure
    let userPages: PageMap | null = null;
    let defaultPages: PageMap | null = null;

    const compute = () => {
      // User-specific config takes priority; fall back to default; fall back to show all
      const pages = userPages ?? defaultPages;
      if (!pages) {
        setAllowedPages(new Set(ALL_PAGE_PATHS));
      } else {
        setAllowedPages(
          new Set(ALL_PAGE_PATHS.filter((p) => pages[p] !== false))
        );
      }
    };

    const unsubUser = onSnapshot(
      doc(db, "navigation_permissions", user.email),
      (snap) => {
        userPages = snap.exists()
          ? ((snap.data()?.pages as PageMap) ?? null)
          : null;
        compute();
      }
    );

    const unsubDefault = onSnapshot(
      doc(db, "navigation_permissions", "_default"),
      (snap) => {
        defaultPages = snap.exists()
          ? ((snap.data()?.pages as PageMap) ?? null)
          : null;
        compute();
      }
    );

    return () => {
      unsubUser();
      unsubDefault();
    };
  }, [user?.email]);

  return { allowedPages };
}
