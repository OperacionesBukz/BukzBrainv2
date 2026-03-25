import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UserListSidebar } from "./UserListSidebar";
import { UserPermissionPanel } from "./UserPermissionPanel";
import type { PermissionTemplate } from "./permission-templates";
import type { AgentPermissions } from "@/lib/agent-modules";
import type { DisplayUser, PageMap, WorkspaceMap } from "./usePermissionsData";

interface PermissionsTabProps {
  displayUsers: DisplayUser[];
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

export function PermissionsTab({
  displayUsers,
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
}: PermissionsTabProps) {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();

  const selectedUser =
    displayUsers.find((u) => u.email === selectedEmail) ?? null;

  return (
    <div className="space-y-4">
      {/* Mobile: Select dropdown instead of sidebar */}
      {isMobile && (
        <Select
          value={selectedEmail ?? ""}
          onValueChange={(v) => setSelectedEmail(v || null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar usuario..." />
          </SelectTrigger>
          <SelectContent>
            {displayUsers.map((u) => {
              const effectivePages = u.pages ?? defaultPages;
              const enabledCount =
                Object.values(effectivePages).filter(Boolean).length;
              return (
                <SelectItem key={u.email} value={u.email}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.displayName}</span>
                    <span className="text-muted-foreground text-xs">
                      · {enabledCount} paginas
                    </span>
                    {u.hasCustomConfig && (
                      <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 ml-1">
                        Custom
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {/* Desktop: Two-column layout */}
      <div
        className={cn(
          "gap-4",
          isMobile ? "flex flex-col" : "grid grid-cols-[280px_1fr]"
        )}
      >
        {/* Sidebar - only desktop */}
        {!isMobile && (
          <div className="h-[calc(100vh-14rem)]">
            <UserListSidebar
              users={displayUsers}
              selectedEmail={selectedEmail}
              onSelect={setSelectedEmail}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        )}

        {/* Permission panel */}
        <div>
          <UserPermissionPanel
            user={selectedUser}
            defaultPages={defaultPages}
            defaultWorkspaces={defaultWorkspaces}
            defaultAgent={defaultAgent}
            saving={saving}
            onTogglePage={onTogglePage}
            onToggleWorkspace={onToggleWorkspace}
            onToggleAgentEnabled={onToggleAgentEnabled}
            onToggleAgentModule={onToggleAgentModule}
            onApplyTemplate={onApplyTemplate}
            onResetToDefault={onResetToDefault}
          />
        </div>
      </div>
    </div>
  );
}
