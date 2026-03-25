import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { db, firebaseConfig } from "@/lib/firebase";
import { toast } from "sonner";
import { ALL_PAGE_PATHS } from "@/lib/pages";
import { PAGE_REGISTRY } from "@/lib/pages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Loader2, Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { buildFullAgentPermissions } from "@/lib/agent-modules";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formPages, setFormPages] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_PAGE_PATHS.map((p) => [p, true]))
  );
  const [formAgentEnabled, setFormAgentEnabled] = useState(false);

  const resetForm = () => {
    setFormEmail("");
    setFormDisplayName("");
    setFormPassword("");
    setFormRole("user");
    setFormPages(Object.fromEntries(ALL_PAGE_PATHS.map((p) => [p, true])));
    setFormAgentEnabled(false);
    setShowPassword(false);
  };

  const handleCreate = async () => {
    if (!formEmail.trim() || !formPassword.trim()) {
      toast.error("Email y contrasena son obligatorios");
      return;
    }
    if (formPassword.length < 6) {
      toast.error("La contrasena debe tener al menos 6 caracteres");
      return;
    }

    setCreating(true);
    let secondaryApp;
    try {
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

      await updateProfile(cred.user, { displayName });

      await setDoc(doc(db, "users", email), {
        email,
        displayName,
        uid,
        role: formRole,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });

      const navData: Record<string, unknown> = { pages: formPages };
      if (formAgentEnabled) {
        navData.agent = buildFullAgentPermissions();
      }
      await setDoc(doc(db, "navigation_permissions", email), navData);

      toast.success(`Usuario ${email} creado exitosamente`);
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Error desconocido";
      if (msg.includes("email-already-in-use")) {
        toast.error("Este correo ya esta registrado");
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear nuevo usuario</DialogTitle>
          <DialogDescription>
            El usuario podra iniciar sesion con estas credenciales
            inmediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electronico</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@bukz.co"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Nombre</Label>
            <Input
              id="displayName"
              placeholder="Nombre completo"
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contrasena temporal</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimo 6 caracteres"
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Permisos de navegacion</Label>
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
              {PAGE_REGISTRY.map((page) => (
                <label
                  key={page.path}
                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={formPages[page.path] ?? true}
                    onCheckedChange={() => togglePage(page.path)}
                  />
                  <span className="text-sm">{page.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Agente AI</Label>
                <p className="text-xs text-muted-foreground">
                  Acceso al asistente inteligente
                </p>
              </div>
            </div>
            <Switch
              checked={formAgentEnabled}
              onCheckedChange={setFormAgentEnabled}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
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
  );
}
