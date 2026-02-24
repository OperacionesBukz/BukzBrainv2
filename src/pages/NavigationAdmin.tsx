import { useState, useEffect } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Trash2,
  Plus,
  ShieldCheck,
  Users,
  Settings2,
  Home,
  ListChecks,
  ClipboardList,
  BookOpen,
  CalendarDays,
  Store,
  UserX,
  Info,
  RotateCcw,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_DEFINITIONS = [
  {
    path: "/dashboard",
    label: "Dashboard",
    description: "Página principal",
    icon: Home,
  },
  {
    path: "/operations",
    label: "Operaciones",
    description: "Tablero de tareas entre áreas",
    icon: ListChecks,
  },
  {
    path: "/tasks",
    label: "Tareas",
    description: "Gestor de tareas personales",
    icon: ClipboardList,
  },
  {
    path: "/instructions",
    label: "Guías",
    description: "Base de conocimiento",
    icon: BookOpen,
  },
  {
    path: "/requests",
    label: "Solicitudes",
    description: "Permisos y vacaciones",
    icon: CalendarDays,
  },
  {
    path: "/bookstore-requests",
    label: "Solicitud Librerías",
    description: "Pedidos para librerías",
    icon: Store,
  },
];

type PageMap = Record<string, boolean>;

interface RegisteredUser {
  email: string;
  displayName: string;
  lastLogin?: { seconds: number } | null;
}

interface UserPermConfig {
  email: string;
  pages: PageMap;
}

const buildDefaultPageMap = (): PageMap =>
  Object.fromEntries(PAGE_DEFINITIONS.map((p) => [p.path, true]));

function formatLastLogin(lastLogin?: { seconds: number } | null): string {
  if (!lastLogin?.seconds) return "Nunca";
  const date = new Date(lastLogin.seconds * 1000);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function NavigationAdmin() {
  const { user, isAdmin, roleLoading } = useAuth();
  const navigate = useNavigate();

  const [defaultPages, setDefaultPages] = useState<PageMap>(
    buildDefaultPageMap()
  );
  const [permConfigs, setPermConfigs] = useState<UserPermConfig[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Access guard — wait for role to load before deciding
  useEffect(() => {
    if (user && !roleLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [user, roleLoading, isAdmin, navigate]);

  // Listen to navigation_permissions
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "navigation_permissions"),
      (snapshot) => {
        const configs: UserPermConfig[] = [];
        let foundDefault = false;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (docSnap.id === "_default") {
            foundDefault = true;
            setDefaultPages({
              ...buildDefaultPageMap(),
              ...(data.pages ?? {}),
            });
          } else {
            configs.push({
              email: docSnap.id,
              pages: { ...buildDefaultPageMap(), ...(data.pages ?? {}) },
            });
          }
        });

        if (!foundDefault) setDefaultPages(buildDefaultPageMap());
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
          lastLogin: data.lastLogin ?? null,
        });
      });
      setRegisteredUsers(
        users
          .filter((u) => u.email !== user?.email)
          .sort((a, b) => a.email.localeCompare(b.email))
      );
    });
    return () => unsub();
  }, []);

  // Merge: all users shown, with their perm config if it exists
  const allUsers = registeredUsers.map((ru) => {
    const config = permConfigs.find((c) => c.email === ru.email);
    return {
      ...ru,
      pages: config?.pages ?? null, // null = using default
      hasCustomConfig: !!config,
    };
  });

  // Users added manually but not in registered users (edge case)
  const manualOnly = permConfigs
    .filter((c) => !registeredUsers.find((r) => r.email === c.email))
    .map((c) => ({
      email: c.email,
      displayName: c.email.split("@")[0],
      lastLogin: null,
      pages: c.pages,
      hasCustomConfig: true,
    }));

  const displayUsers = [...allUsers, ...manualOnly].sort((a, b) =>
    a.email.localeCompare(b.email)
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const saveDefault = async (pages: PageMap) => {
    setSaving("_default");
    try {
      await setDoc(doc(db, "navigation_permissions", "_default"), { pages });
      toast.success("Configuración por defecto guardada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(null);
    }
  };

  const toggleDefault = async (path: string, value: boolean) => {
    const updated = { ...defaultPages, [path]: value };
    setDefaultPages(updated);
    await saveDefault(updated);
  };

  const saveUserConfig = async (email: string, pages: PageMap) => {
    setSaving(email);
    try {
      await setDoc(doc(db, "navigation_permissions", email), { pages });
      toast.success(`Permisos de ${email} guardados`);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(null);
    }
  };

  const toggleUser = async (
    email: string,
    path: string,
    value: boolean,
    currentPages: PageMap | null
  ) => {
    const base = currentPages ?? defaultPages;
    const updated = { ...base, [path]: value };
    await saveUserConfig(email, updated);
  };

  const resetToDefault = async (email: string) => {
    try {
      await deleteDoc(doc(db, "navigation_permissions", email));
      toast.success(`${email} ahora usa la configuración por defecto`);
    } catch {
      toast.error("Error al restablecer");
    }
  };

  const addManualUser = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Ingresa un correo electrónico válido");
      return;
    }
    if (permConfigs.find((c) => c.email === email)) {
      toast.error("Este usuario ya tiene configuración específica");
      return;
    }
    await saveUserConfig(email, { ...defaultPages });
    setNewEmail("");
  };

  if (!user || roleLoading || !isAdmin) return null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Permisos de Navegación
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controla qué páginas puede ver cada usuario en la plataforma.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Los cambios aplican de forma inmediata. Si un usuario tiene
          configuración <strong>personalizada</strong>, tiene prioridad sobre la
          predeterminada. Los usuarios aparecen automáticamente al iniciar
          sesión por primera vez.
        </p>
      </div>

      {/* ── Default config ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">
              Configuración por defecto
            </CardTitle>
          </div>
          <CardDescription>
            Aplica a todos los usuarios sin configuración personalizada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAGE_DEFINITIONS.map((page) => {
              const enabled = defaultPages[page.path] ?? true;
              return (
                <div
                  key={page.path}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 transition-all",
                    enabled
                      ? "border-border bg-card"
                      : "border-dashed border-border/50 bg-muted/20 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <page.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none mb-0.5">
                        {page.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {page.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => toggleDefault(page.path, v)}
                    disabled={saving === "_default"}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Users list ────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Usuarios</h2>
            {displayUsers.length > 0 && (
              <Badge variant="secondary" className="text-xs h-5">
                {displayUsers.length}
              </Badge>
            )}
          </div>
        </div>

        {/* Add user manually */}
        <div className="flex gap-2">
          <Input
            placeholder="correo@bukz.co (si aún no ha iniciado sesión)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManualUser()}
            className="text-sm"
          />
          <Button onClick={addManualUser} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>

        {/* Empty state */}
        {displayUsers.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <UserX className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Ningún usuario ha iniciado sesión aún.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Los usuarios aparecen aquí automáticamente al ingresar a la
              plataforma.
            </p>
          </div>
        )}

        {/* User cards */}
        <div className="grid gap-3">
          {displayUsers.map((u) => {
            const isExpanded = expandedUser === u.email;
            const effectivePages = u.pages ?? defaultPages;
            const enabledCount = Object.values(effectivePages).filter(Boolean).length;

            return (
              <Card key={u.email} className="overflow-hidden">
                {/* Card header — always visible */}
                <button
                  className="w-full text-left"
                  onClick={() =>
                    setExpandedUser(isExpanded ? null : u.email)
                  }
                >
                  <CardHeader className="py-3 px-4 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {u.displayName[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-none mb-0.5">
                            {u.email}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {u.hasCustomConfig ? (
                              <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                Personalizado · {enabledCount} páginas
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                                Default · {enabledCount} páginas
                              </Badge>
                            )}
                            {u.lastLogin && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatLastLogin(u.lastLogin)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </CardHeader>
                </button>

                {/* Expandable permissions */}
                {isExpanded && (
                  <CardContent className="p-3 border-t">
                    <div className="grid gap-1.5 sm:grid-cols-2 mb-3">
                      {PAGE_DEFINITIONS.map((page) => {
                        const enabled = effectivePages[page.path] ?? true;
                        return (
                          <div
                            key={page.path}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-all",
                              enabled ? "bg-muted/30" : "opacity-50"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <page.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs font-medium truncate">
                                {page.label}
                              </span>
                              {!u.hasCustomConfig && (
                                <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                                  (default)
                                </span>
                              )}
                            </div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(v) =>
                                toggleUser(u.email, page.path, v, u.pages)
                              }
                              disabled={saving === u.email}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-1 border-t">
                      {u.hasCustomConfig && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => resetToDefault(u.email)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restablecer a default
                        </Button>
                      )}
                      {!registeredUsers.find((r) => r.email === u.email) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => resetToDefault(u.email)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
