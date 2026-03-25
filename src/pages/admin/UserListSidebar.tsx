import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DisplayUser } from "./usePermissionsData";

interface UserListSidebarProps {
  users: DisplayUser[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function UserListSidebar({
  users,
  selectedEmail,
  onSelect,
  searchQuery,
  onSearchChange,
}: UserListSidebarProps) {
  const filtered = users.filter(
    (u) =>
      !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar usuario..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 text-sm h-9"
          />
        </div>
      </div>

      {/* User list */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <UserX className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? "Sin resultados"
                : "No hay usuarios"}
            </p>
          </div>
        ) : (
          <div className="p-1.5">
            {filtered.map((u) => {
              const isSelected = u.email === selectedEmail;
              return (
                <button
                  key={u.email}
                  onClick={() => onSelect(u.email)}
                  className={cn(
                    "flex items-center gap-2.5 w-full rounded-md px-3 py-2.5 text-left transition-all duration-150",
                    isSelected
                      ? "bg-primary/10 ring-1 ring-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {u.displayName[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-none mb-1 truncate">
                      {u.displayName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {u.email}
                    </p>
                  </div>
                  <Badge
                    variant={u.hasCustomConfig ? "default" : "outline"}
                    className={cn(
                      "text-[9px] h-4 px-1.5 shrink-0",
                      u.hasCustomConfig
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        : "text-muted-foreground"
                    )}
                  >
                    {u.hasCustomConfig ? "Custom" : "Default"}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer count */}
      <div className="px-3 py-2 border-t">
        <p className="text-[11px] text-muted-foreground">
          {filtered.length} de {users.length} usuarios
        </p>
      </div>
    </div>
  );
}
