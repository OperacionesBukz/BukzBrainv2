import { Switch } from "@/components/ui/switch";
import { Info, Loader2, Layers, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_REGISTRY } from "@/lib/pages";
import { WORKSPACE_IDS, WORKSPACES } from "@/lib/workspaces";
import { AGENT_MODULES, type AgentPermissions } from "@/lib/agent-modules";
import type { PageMap, WorkspaceMap } from "./usePermissionsData";

interface DefaultConfigTabProps {
  defaultPages: PageMap;
  defaultWorkspaces: WorkspaceMap;
  defaultAgent: AgentPermissions;
  saving: string | null;
  onTogglePage: (path: string, value: boolean) => void;
  onToggleWorkspace: (wsId: string, value: boolean) => void;
  onToggleAgentEnabled: (enabled: boolean) => void;
  onToggleAgentModule: (moduleId: string, value: boolean) => void;
}

export function DefaultConfigTab({
  defaultPages,
  defaultWorkspaces,
  defaultAgent,
  saving,
  onTogglePage,
  onToggleWorkspace,
  onToggleAgentEnabled,
  onToggleAgentModule,
}: DefaultConfigTabProps) {
  const isSaving = saving === "_default";

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Esta configuracion aplica a todos los usuarios que <strong>no</strong>{" "}
          tienen permisos personalizados. Los cambios se aplican de forma
          inmediata.
        </p>
      </div>

      {/* Page toggles */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Paginas</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {PAGE_REGISTRY.map((page) => {
            const enabled = defaultPages[page.path] ?? true;
            return (
              <div
                key={page.path}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-3 transition-all duration-200",
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
                <div className="flex items-center gap-2 shrink-0">
                  {isSaving && (
                    <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                  )}
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => onTogglePage(page.path, v)}
                    className={cn(isSaving && "pointer-events-none opacity-70")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workspace access toggles */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Acceso a Workspaces</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKSPACE_IDS.map((wsId) => {
            const ws = WORKSPACES[wsId];
            const enabled = defaultWorkspaces[wsId] ?? false;
            const isGeneral = wsId === "general";
            return (
              <div
                key={wsId}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-3 transition-all duration-200",
                  enabled
                    ? "border-border bg-card"
                    : "border-dashed border-border/50 bg-muted/20 opacity-60"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <ws.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">
                      {ws.label}
                    </p>
                    {isGeneral && (
                      <p className="text-xs text-muted-foreground">
                        Siempre activo
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSaving && (
                    <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                  )}
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => onToggleWorkspace(wsId, v)}
                    disabled={isGeneral}
                    className={cn(
                      (isSaving || isGeneral) && "pointer-events-none opacity-70"
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent AI access */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Agente AI</h3>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && (
              <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
            )}
            <Switch
              checked={defaultAgent.enabled}
              onCheckedChange={onToggleAgentEnabled}
              className={cn(isSaving && "pointer-events-none opacity-70")}
            />
          </div>
        </div>
        <div className={cn("grid gap-3 sm:grid-cols-2 transition-opacity", !defaultAgent.enabled && "opacity-40 pointer-events-none")}>
          {AGENT_MODULES.map((mod) => {
            const enabled = defaultAgent.modules[mod.id] ?? true;
            return (
              <div
                key={mod.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-3 transition-all duration-200",
                  enabled
                    ? "border-border bg-card"
                    : "border-dashed border-border/50 bg-muted/20 opacity-60"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none mb-0.5">
                      {mod.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {mod.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSaving && (
                    <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                  )}
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => onToggleAgentModule(mod.id, v)}
                    className={cn(isSaving && "pointer-events-none opacity-70")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
