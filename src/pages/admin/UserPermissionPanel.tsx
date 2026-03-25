import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  Loader2,
  Layers,
  RotateCcw,
  ChevronDown,
  Wand2,
  ShieldCheck,
  UserX,
  Crown,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPER_ADMIN_EMAIL } from "@/contexts/AuthContext";
import { PAGE_REGISTRY } from "@/lib/pages";
import { WORKSPACE_IDS, WORKSPACES } from "@/lib/workspaces";
import {
  PERMISSION_TEMPLATES,
  type PermissionTemplate,
} from "./permission-templates";
import { AGENT_MODULES, buildDefaultAgentPermissions, type AgentPermissions } from "@/lib/agent-modules";
import type { DisplayUser, PageMap, WorkspaceMap } from "./usePermissionsData";
import { formatLastLogin } from "./usePermissionsData";

interface UserPermissionPanelProps {
  user: DisplayUser | null;
  defaultPages: PageMap;
  defaultWorkspaces: WorkspaceMap;
  defaultAgent: AgentPermissions;
  saving: string | null;
  onTogglePage: (
    email: string,
    path: string,
    value: boolean,
    currentPages: PageMap | null,
    currentWorkspaces: WorkspaceMap | null
  ) => void;
  onToggleWorkspace: (
    email: string,
    wsId: string,
    value: boolean,
    currentPages: PageMap | null,
    currentWorkspaces: WorkspaceMap | null
  ) => void;
  onToggleAgentEnabled: (email: string, enabled: boolean) => void;
  onToggleAgentModule: (email: string, moduleId: string, value: boolean) => void;
  onApplyTemplate: (email: string, template: PermissionTemplate) => void;
  onResetToDefault: (email: string) => void;
}

const generalPages = PAGE_REGISTRY.filter(
  (p) => p.workspace === "general" || p.workspace === "both"
);
const operacionesPages = PAGE_REGISTRY.filter(
  (p) => p.workspace === "operaciones" || p.workspace === "both"
);

export function UserPermissionPanel({
  user,
  defaultPages,
  defaultWorkspaces,
  defaultAgent,
  saving,
  onTogglePage,
  onToggleWorkspace,
  onToggleAgentEnabled,
  onToggleAgentModule,
  onApplyTemplate,
  onResetToDefault,
}: UserPermissionPanelProps) {
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] border rounded-lg bg-card">
        <UserX className="h-10 w-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground">
          Selecciona un usuario para ver sus permisos
        </p>
      </div>
    );
  }

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const effectivePages = user.pages ?? defaultPages;
  const effectiveWorkspaces = user.workspaces ?? defaultWorkspaces;
  const effectiveAgent = user.agent ?? defaultAgent;
  const enabledCount = Object.values(effectivePages).filter(Boolean).length;
  const isSaving = saving === user.email;

  const renderPageGroup = (
    title: string,
    icon: React.ReactNode,
    pages: typeof PAGE_REGISTRY
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {pages.map((page) => {
          const enabled = effectivePages[page.path] ?? true;
          return (
            <div
              key={page.path}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-all duration-200",
                enabled ? "bg-muted/30" : "opacity-50"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <page.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium truncate">
                  {page.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSaving && (
                  <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                )}
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) =>
                    onTogglePage(
                      user.email,
                      page.path,
                      v,
                      user.pages,
                      user.workspaces
                    )
                  }
                  className={cn(isSaving && "pointer-events-none opacity-70")}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="border rounded-lg bg-card overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="px-4 py-3 bg-muted/20 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {user.displayName[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isSuperAdmin ? (
              <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                <Crown className="h-2.5 w-2.5 mr-1" />
                Super Admin · Acceso total
              </Badge>
            ) : user.hasCustomConfig ? (
              <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                Personalizado · {enabledCount} paginas
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 text-muted-foreground"
              >
                Default · {enabledCount} paginas
              </Badge>
            )}
            {user.lastLogin && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {formatLastLogin(user.lastLogin)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions bar */}
      {isSuperAdmin ? (
        <div className="px-4 py-3 border-b bg-amber-50/50 dark:bg-amber-900/10 flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Este usuario es Super Admin permanente con acceso total. Sus permisos no pueden ser modificados.
          </p>
        </div>
      ) : (
        <div className="px-4 py-2 border-b bg-muted/10 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Wand2 className="h-3 w-3" />
                Aplicar Template
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PERMISSION_TEMPLATES.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => onApplyTemplate(user.email, t)}
                  className="gap-2"
                >
                  <t.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user.hasCustomConfig && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => onResetToDefault(user.email)}
            >
              <RotateCcw className="h-3 w-3" />
              Restablecer a default
            </Button>
          )}

          {user.role === "admin" && (
            <Badge className="ml-auto text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
              <ShieldCheck className="h-2.5 w-2.5 mr-1" />
              Admin
            </Badge>
          )}
        </div>
      )}

      {/* Permissions content */}
      <div className={cn("p-4 space-y-5", isSuperAdmin && "opacity-50 pointer-events-none")}>
        {/* General pages */}
        {renderPageGroup(
          "General",
          <WORKSPACES.general.icon className="h-3.5 w-3.5 text-muted-foreground" />,
          generalPages
        )}

        {/* Operaciones pages */}
        {renderPageGroup(
          "Operaciones",
          <WORKSPACES.operaciones.icon className="h-3.5 w-3.5 text-muted-foreground" />,
          operacionesPages
        )}

        {/* Workspace toggles */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Acceso a Workspaces
            </h4>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {WORKSPACE_IDS.map((wsId) => {
              const ws = WORKSPACES[wsId];
              const enabled = effectiveWorkspaces[wsId] ?? false;
              const isGeneral = wsId === "general";
              return (
                <div
                  key={wsId}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-all duration-200",
                    enabled ? "bg-muted/30" : "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ws.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium">{ws.label}</span>
                    {isGeneral && (
                      <span className="text-[10px] text-muted-foreground/60">
                        (siempre)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSaving && (
                      <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                    )}
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) =>
                        onToggleWorkspace(
                          user.email,
                          wsId,
                          v,
                          user.pages,
                          user.workspaces
                        )
                      }
                      disabled={isGeneral}
                      className={cn(
                        (isSaving || isGeneral) &&
                          "pointer-events-none opacity-70"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent AI toggles */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Agente AI
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && (
                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
              )}
              <Switch
                checked={effectiveAgent.enabled}
                onCheckedChange={(v) => onToggleAgentEnabled(user.email, v)}
                className={cn(isSaving && "pointer-events-none opacity-70")}
              />
            </div>
          </div>
          <div className={cn("grid gap-1.5 sm:grid-cols-2 transition-opacity", !effectiveAgent.enabled && "opacity-40 pointer-events-none")}>
            {AGENT_MODULES.map((mod) => {
              const enabled = effectiveAgent.modules[mod.id] ?? true;
              return (
                <div
                  key={mod.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-all duration-200",
                    enabled ? "bg-muted/30" : "opacity-50"
                  )}
                >
                  <div className="min-w-0">
                    <span className="text-xs font-medium">{mod.label}</span>
                    <p className="text-[10px] text-muted-foreground">{mod.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => onToggleAgentModule(user.email, mod.id, v)}
                    className={cn(isSaving && "pointer-events-none opacity-70")}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
