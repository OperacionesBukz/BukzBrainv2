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
} from "lucide-react";
import { cn } from "@/lib/utils";

const OPERATIONS_EMAIL = "operaciones@bukz.co";

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
type UserConfig = { email: string; pages: PageMap };

const buildDefaultPageMap = (): PageMap =>
  Object.fromEntries(PAGE_DEFINITIONS.map((p) => [p.path, true]));

export default function NavigationAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [defaultPages, setDefaultPages] = useState<PageMap>(
    buildDefaultPageMap()
  );
  const [userConfigs, setUserConfigs] = useState<UserConfig[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Access guard
  useEffect(() => {
    if (user && user.email !== OPERATIONS_EMAIL) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Real-time listener for all navigation_permissions documents
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "navigation_permissions"),
      (snapshot) => {
        const configs: UserConfig[] = [];
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

        if (!foundDefault) {
          setDefaultPages(buildDefaultPageMap());
        }

        setUserConfigs(
          configs.sort((a, b) => a.email.localeCompare(b.email))
        );
      }
    );

    return () => unsub();
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const saveDefault = async (pages: PageMap) => {
    setSaving("_default");
    try {
      await setDoc(doc(db, "navigation_permissions", "_default"), { pages });
      toast.success("Configuración por defecto guardada");
    } catch {
      toast.error("Error al guardar la configuración");
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
      toast.error("Error al guardar los permisos");
    } finally {
      setSaving(null);
    }
  };

  const toggleUser = async (email: string, path: string, value: boolean) => {
    const existing = userConfigs.find((c) => c.email === email);
    const updated = { ...(existing?.pages ?? buildDefaultPageMap()), [path]: value };
    await saveUserConfig(email, updated);
  };

  const addUser = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Ingresa un correo electrónico válido");
      return;
    }
    if (userConfigs.find((c) => c.email === email)) {
      toast.error("Este usuario ya tiene configuración específica");
      return;
    }
    // Inherit current default config as starting point
    await saveUserConfig(email, { ...defaultPages });
    setNewEmail("");
  };

  const deleteUserConfig = async (email: string) => {
    try {
      await deleteDoc(doc(db, "navigation_permissions", email));
      toast.success(`Configuración de ${email} eliminada`);
    } catch {
      toast.error("Error al eliminar la configuración");
    }
  };

  if (!user || user.email !== OPERATIONS_EMAIL) return null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Permisos de Navegación
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controla qué páginas puede ver cada usuario en la plataforma sin
            necesidad de tocar el código.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Los cambios se aplican de forma inmediata. Los usuarios sin
          configuración específica heredan la{" "}
          <strong>configuración por defecto</strong>. Si un usuario tiene
          configuración propia, esta tiene prioridad sobre la predeterminada.
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
            Aplica a todos los usuarios que no tienen configuración específica
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

      {/* ── Per-user overrides ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Configuración por usuario</h2>
          {userConfigs.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5">
              {userConfigs.length}
            </Badge>
          )}
        </div>

        {/* Add user form */}
        <div className="flex gap-2">
          <Input
            placeholder="correo@bukz.co"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addUser()}
            className="max-w-xs text-sm"
          />
          <Button onClick={addUser} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Agregar usuario
          </Button>
        </div>

        {/* Empty state */}
        {userConfigs.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <UserX className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Sin configuraciones específicas.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Todos los usuarios usan la configuración por defecto.
            </p>
          </div>
        )}

        {/* User cards */}
        <div className="grid gap-3">
          {userConfigs.map((config) => (
            <Card key={config.email} className="overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {config.email[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium truncate">
                      {config.email}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs h-5 hidden sm:flex"
                    >
                      {
                        Object.values(config.pages).filter(Boolean).length
                      }{" "}
                      páginas
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => deleteUserConfig(config.email)}
                    title="Eliminar configuración específica"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {PAGE_DEFINITIONS.map((page) => {
                    const enabled = config.pages[page.path] ?? true;
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
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) =>
                            toggleUser(config.email, page.path, v)
                          }
                          disabled={saving === config.email}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
