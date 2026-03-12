import { useState, useEffect } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { db, firebaseConfig } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ALL_PAGE_PATHS } from "@/hooks/useNavigationPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserPlus,
  Users,
  Loader2,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RegisteredUser {
  email: string;
  displayName: string;
  role: string | null;
  uid: string;
  lastLogin?: { seconds: number } | null;
  createdAt?: { seconds: number } | null;
}

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/operations": "Operaciones",
  "/tasks": "Tareas",
  "/instructions": "Guías",
  "/requests": "Solicitudes",
  "/bookstore-requests": "Solicitud Librerías",
  "/reposicion": "Reposición",
  "/celesa": "Celesa",
};

function formatTimestamp(ts?: { seconds: number } | null): string {
  if (!ts?.seconds) return "Nunca";
  const date = new Date(ts.seconds * 1000);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function UserAdmin() {
  const { user, isAdmin, roleLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formPages, setFormPages] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_PAGE_PATHS.map((p) => [p, true]))
  );

  // Access guard
  useEffect(() => {
    if (user && !roleLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [user, roleLoading, isAdmin, navigate]);

  // Listen to users collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: RegisteredUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          email: docSnap.id,
          displayName: data.displayName || docSnap.id.split("@")[0],
          role: data.role || null,
          uid: data.uid || "",
          lastLogin: data.lastLogin ?? null,
          createdAt: data.createdAt ?? null,
        });
      });
      setUsers(list.sort((a, b) => a.email.localeCompare(b.email)));
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setFormEmail("");
    setFormDisplayName("");
    setFormPassword("");
    setFormRole("user");
    setFormPages(Object.fromEntries(ALL_PAGE_PATHS.map((p) => [p, true])));
    setShowPassword(false);
  };

  const handleCreate = async () => {
    if (!formEmail.trim() || !formPassword.trim()) {
      toast.error("Email y contraseña son obligatorios");
      return;
    }
    if (formPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setCreating(true);
    let secondaryApp;
    try {
      // Create user via secondary app to avoid signing out the admin
      secondaryApp = initializeApp(firebaseConfig, "secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        formEmail.trim(),
        formPassword
      );

      const uid = cred.user.uid;
      const email = formEmail.trim().toLowerCase();
      const displayName = formDisplayName.trim() || email.split("@")[0];

      // Update display name on the auth user
      await updateProfile(cred.user, { displayName });

      // Write user doc
      await setDoc(doc(db, "users", email), {
        email,
        displayName,
        uid,
        role: formRole,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });

      // Write navigation permissions
      await setDoc(doc(db, "navigation_permissions", email), {
        pages: formPages,
      });

      toast.success(`Usuario ${email} creado exitosamente`);
      setDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Error desconocido";
      if (msg.includes("email-already-in-use")) {
        toast.error("Este correo ya está registrado");
      } else {
        toast.error(`Error al crear usuario: ${msg}`);
      }
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp).catch(() => {});
      }
      setCreating(false);
    }
  };

  const togglePage = (path: string) => {
    setFormPages((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const selectAllPages = () => {
    setFormPages(Object.fromEntries(ALL_PAGE_PATHS.map((p) => [p, true])));
  };

  const deselectAllPages = () => {
    setFormPages(Object.fromEntries(ALL_PAGE_PATHS.map((p) => [p, false])));
  };

  if (!user || roleLoading || !isAdmin) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Users className="h-5 w-5 text-black dark:text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Gestión de Usuarios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Administra los usuarios de la plataforma, crea cuentas nuevas y
              asigna roles y permisos.
            </p>
          </div>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" />
              Crear Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear nuevo usuario</DialogTitle>
              <DialogDescription>
                El usuario podrá iniciar sesión con estas credenciales
                inmediatamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@bukz.co"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Nombre</Label>
                <Input
                  id="displayName"
                  placeholder="Nombre completo"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña temporal</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Navigation Permissions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Permisos de navegación</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="text-xs text-primary hover:underline"
                    >
                      Todas
                    </button>
                    <span className="text-xs text-muted-foreground">/</span>
                    <button
                      type="button"
                      onClick={deselectAllPages}
                      className="text-xs text-primary hover:underline"
                    >
                      Ninguna
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                  {ALL_PAGE_PATHS.map((path) => (
                    <label
                      key={path}
                      className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={formPages[path] ?? true}
                        onCheckedChange={() => togglePage(path)}
                      />
                      <span className="text-sm">
                        {PAGE_LABELS[path] || path}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating} className="gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear usuario
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden md:table-cell">
                Último acceso
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No hay usuarios registrados aún.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.email}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {(u.displayName || u.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium truncate">
                        {u.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{u.displayName}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === "admin" ? "default" : "secondary"}
                      className={cn(
                        "text-xs",
                        u.role === "admin" &&
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      )}
                    >
                      {u.role === "admin" && (
                        <ShieldCheck className="h-3 w-3 mr-1" />
                      )}
                      {u.role === "admin" ? "Admin" : "Usuario"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(u.lastLogin)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
