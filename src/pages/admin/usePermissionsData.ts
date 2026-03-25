import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PAGE_REGISTRY } from "@/lib/pages";
import { WORKSPACE_IDS } from "@/lib/workspaces";
import { buildDefaultAgentPermissions, type AgentPermissions } from "@/lib/agent-modules";

export type PageMap = Record<string, boolean>;
export type WorkspaceMap = Record<string, boolean>;

export interface RegisteredUser {
  email: string;
  displayName: string;
  role: string | null;
  uid: string;
  lastLogin?: { seconds: number } | null;
  createdAt?: { seconds: number } | null;
}

export interface DisplayUser extends RegisteredUser {
  pages: PageMap | null;
  workspaces: WorkspaceMap | null;
  agent: AgentPermissions | null;
  hasCustomConfig: boolean;
}

export const buildDefaultPageMap = (): PageMap =>
  Object.fromEntries(PAGE_REGISTRY.map((p) => [p.path, true]));

export const buildDefaultWorkspaceMap = (): WorkspaceMap =>
  Object.fromEntries(WORKSPACE_IDS.map((id) => [id, id === "general"]));

export function formatLastLogin(lastLogin?: { seconds: number } | null): string {
  if (!lastLogin?.seconds) return "Nunca";
  const date = new Date(lastLogin.seconds * 1000);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function usePermissionsData() {
  const { user } = useAuth();

  const [defaultPages, setDefaultPages] = useState<PageMap>(buildDefaultPageMap());
  const [defaultWorkspaces, setDefaultWorkspaces] = useState<WorkspaceMap>(buildDefaultWorkspaceMap());
  const [defaultAgent, setDefaultAgent] = useState<AgentPermissions>(buildDefaultAgentPermissions());
  const [permConfigs, setPermConfigs] = useState<{ email: string; pages: PageMap; workspaces: WorkspaceMap | null; agent: AgentPermissions | null }[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  // Listen to navigation_permissions
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "navigation_permissions"),
      (snapshot) => {
        const configs: { email: string; pages: PageMap; workspaces: WorkspaceMap | null; agent: AgentPermissions | null }[] = [];
        let foundDefault = false;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (docSnap.id === "_default") {
            foundDefault = true;
            setDefaultPages({ ...buildDefaultPageMap(), ...(data.pages ?? {}) });
            setDefaultWorkspaces({ ...buildDefaultWorkspaceMap(), ...(data.workspaces ?? {}) });
            setDefaultAgent(data.agent ?? buildDefaultAgentPermissions());
          } else {
            configs.push({
              email: docSnap.id,
              pages: { ...buildDefaultPageMap(), ...(data.pages ?? {}) },
              workspaces: data.workspaces ?? null,
              agent: data.agent ?? null,
            });
          }
        });

        if (!foundDefault) {
          setDefaultPages(buildDefaultPageMap());
          setDefaultWorkspaces(buildDefaultWorkspaceMap());
          setDefaultAgent(buildDefaultAgentPermissions());
        }
        setPermConfigs(configs);
      }
    );
    return () => unsub();
  }, []);

  // Listen to registered users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const users: RegisteredUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        users.push({
          email: docSnap.id,
          displayName: data.displayName || docSnap.id.split("@")[0],
          role: data.role || null,
          uid: data.uid || "",
          lastLogin: data.lastLogin ?? null,
          createdAt: data.createdAt ?? null,
        });
      });
      setRegisteredUsers(
        users
          .filter((u) => u.email !== user?.email)
          .sort((a, b) => a.email.localeCompare(b.email))
      );
    });
    return () => unsub();
  }, [user?.email]);

  // Merge: all users with their perm config if it exists
  const allUsers = registeredUsers.map((ru) => {
    const config = permConfigs.find((c) => c.email === ru.email);
    return {
      ...ru,
      pages: config?.pages ?? null,
      workspaces: config?.workspaces ?? null,
      agent: config?.agent ?? null,
      hasCustomConfig: !!config,
    };
  });

  // Users added manually but not in registered users
  const manualOnly = permConfigs
    .filter((c) => !registeredUsers.find((r) => r.email === c.email))
    .map((c) => ({
      email: c.email,
      displayName: c.email.split("@")[0],
      role: null as string | null,
      uid: "",
      lastLogin: null as { seconds: number } | null,
      createdAt: null as { seconds: number } | null,
      pages: c.pages,
      workspaces: c.workspaces,
      agent: c.agent,
      hasCustomConfig: true,
    }));

  const displayUsers: DisplayUser[] = [...allUsers, ...manualOnly].sort((a, b) =>
    a.email.localeCompare(b.email)
  );

  // ─── Handlers ──────────────────────────────────────────────────────

  const saveDefault = useCallback(async (pages: PageMap, workspaces: WorkspaceMap, agent?: AgentPermissions) => {
    setSaving("_default");
    try {
      const data: Record<string, unknown> = { pages, workspaces };
      if (agent) data.agent = agent;
      await setDoc(doc(db, "navigation_permissions", "_default"), data, { merge: true });
      toast.success("Configuracion por defecto guardada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(null);
    }
  }, []);

  const toggleDefaultPage = useCallback(async (path: string, value: boolean) => {
    setDefaultPages((prev) => {
      const updated = { ...prev, [path]: value };
      saveDefault(updated, defaultWorkspaces);
      return updated;
    });
  }, [defaultWorkspaces, saveDefault]);

  const toggleDefaultWorkspace = useCallback(async (wsId: string, value: boolean) => {
    setDefaultWorkspaces((prev) => {
      const updated = { ...prev, [wsId]: value };
      saveDefault(defaultPages, updated);
      return updated;
    });
  }, [defaultPages, saveDefault]);

  const saveUserConfig = useCallback(async (email: string, pages: PageMap, workspaces?: WorkspaceMap) => {
    setSaving(email);
    try {
      const data: Record<string, unknown> = { pages };
      if (workspaces) data.workspaces = workspaces;
      await setDoc(doc(db, "navigation_permissions", email), data);
      toast.success(`Permisos de ${email} guardados`);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(null);
    }
  }, []);

  const toggleUserPage = useCallback(async (
    email: string,
    path: string,
    value: boolean,
    currentPages: PageMap | null,
    currentWorkspaces: WorkspaceMap | null
  ) => {
    const base = currentPages ?? defaultPages;
    const updated = { ...base, [path]: value };
    await saveUserConfig(email, updated, currentWorkspaces ?? undefined);
  }, [defaultPages, saveUserConfig]);

  const toggleUserWorkspace = useCallback(async (
    email: string,
    wsId: string,
    value: boolean,
    currentPages: PageMap | null,
    currentWorkspaces: WorkspaceMap | null
  ) => {
    const basePages = currentPages ?? defaultPages;
    const baseWs = currentWorkspaces ?? defaultWorkspaces;
    const updatedWs = { ...baseWs, [wsId]: value };
    await saveUserConfig(email, basePages, updatedWs);
  }, [defaultPages, defaultWorkspaces, saveUserConfig]);

  const resetToDefault = useCallback(async (email: string) => {
    try {
      await deleteDoc(doc(db, "navigation_permissions", email));
      toast.success(`${email} ahora usa la configuracion por defecto`);
    } catch {
      toast.error("Error al restablecer");
    }
  }, []);

  const addManualUser = useCallback(async (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      toast.error("Ingresa un correo electronico valido");
      return false;
    }
    if (permConfigs.find((c) => c.email === normalized)) {
      toast.error("Este usuario ya tiene configuracion especifica");
      return false;
    }
    await saveUserConfig(normalized, { ...defaultPages });
    return true;
  }, [permConfigs, defaultPages, saveUserConfig]);

  // ─── Agent permission handlers ────────────────────────────────────

  const toggleDefaultAgentEnabled = useCallback(async (enabled: boolean) => {
    const updated = { ...defaultAgent, enabled };
    setDefaultAgent(updated);
    await saveDefault(defaultPages, defaultWorkspaces, updated);
  }, [defaultAgent, defaultPages, defaultWorkspaces, saveDefault]);

  const toggleDefaultAgentModule = useCallback(async (moduleId: string, value: boolean) => {
    const updated = { ...defaultAgent, modules: { ...defaultAgent.modules, [moduleId]: value } };
    setDefaultAgent(updated);
    await saveDefault(defaultPages, defaultWorkspaces, updated);
  }, [defaultAgent, defaultPages, defaultWorkspaces, saveDefault]);

  const toggleUserAgentEnabled = useCallback(async (email: string, enabled: boolean) => {
    setSaving(email);
    try {
      const config = permConfigs.find((c) => c.email === email);
      const currentAgent = config?.agent ?? defaultAgent;
      const updated = { ...currentAgent, enabled };
      await setDoc(doc(db, "navigation_permissions", email), { agent: updated }, { merge: true });
      toast.success(`Permisos de agente de ${email} guardados`);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(null);
    }
  }, [permConfigs, defaultAgent]);

  const toggleUserAgentModule = useCallback(async (email: string, moduleId: string, value: boolean) => {
    setSaving(email);
    try {
      const config = permConfigs.find((c) => c.email === email);
      const currentAgent = config?.agent ?? defaultAgent;
      const updated = { ...currentAgent, modules: { ...currentAgent.modules, [moduleId]: value } };
      await setDoc(doc(db, "navigation_permissions", email), { agent: updated }, { merge: true });
      toast.success(`Permisos de agente de ${email} guardados`);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(null);
    }
  }, [permConfigs, defaultAgent]);

  return {
    defaultPages,
    defaultWorkspaces,
    defaultAgent,
    registeredUsers,
    displayUsers,
    saving,
    toggleDefaultPage,
    toggleDefaultWorkspace,
    toggleDefaultAgentEnabled,
    toggleDefaultAgentModule,
    saveUserConfig,
    toggleUserPage,
    toggleUserWorkspace,
    toggleUserAgentEnabled,
    toggleUserAgentModule,
    resetToDefault,
    addManualUser,
  };
}
