import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type WorkspaceId, type WorkspaceConfig, WORKSPACE_IDS, WORKSPACES } from "@/lib/workspaces";

interface WorkspaceSwitcherProps {
  current: WorkspaceConfig;
  onSwitch: (id: WorkspaceId) => void;
  collapsed?: boolean;
  allowedWorkspaces: Set<WorkspaceId>;
}

export function WorkspaceSwitcher({ current, onSwitch, collapsed, allowedWorkspaces }: WorkspaceSwitcherProps) {
  const visibleWorkspaces = WORKSPACE_IDS.filter(
    (id) => allowedWorkspaces.has(id)
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out w-full",
          "text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center px-0"
        )}
      >
        <current.icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{current.label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {visibleWorkspaces.map((id) => {
          const ws = WORKSPACES[id];
          const isActive = id === current.id;
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => onSwitch(id)}
              className="flex items-center gap-2"
            >
              <ws.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{ws.label}</span>
              {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
