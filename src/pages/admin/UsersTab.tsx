import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { UserPlus, Users, Clock, ShieldCheck, Search, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPER_ADMIN_EMAIL } from "@/contexts/AuthContext";
import { CreateUserDialog } from "./CreateUserDialog";
import type { RegisteredUser } from "./usePermissionsData";
import { formatLastLogin } from "./usePermissionsData";

interface UsersTabProps {
  users: RegisteredUser[];
}

export function UsersTab({ users }: UsersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "admin" && u.role === "admin") ||
      (roleFilter === "user" && u.role !== "admin");
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">Usuario</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Crear Usuario</span>
          <span className="sm:hidden">Crear</span>
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden sm:table-cell">Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden md:table-cell">
                Ultimo acceso
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || roleFilter !== "all"
                      ? "No se encontraron usuarios con esos filtros."
                      : "No hay usuarios registrados aun."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.email}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {(u.displayName || u.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {u.email}
                        </span>
                        <span className="text-xs text-muted-foreground sm:hidden block">
                          {u.displayName}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm hidden sm:table-cell">
                    {u.displayName}
                  </TableCell>
                  <TableCell>
                    {u.email === SUPER_ADMIN_EMAIL ? (
                      <Badge
                        className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      >
                        <Crown className="h-3 w-3 mr-1" />
                        Super Admin
                      </Badge>
                    ) : (
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
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatLastLogin(u.lastLogin)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
