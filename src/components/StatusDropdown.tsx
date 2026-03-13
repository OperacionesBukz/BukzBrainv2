import { LucideIcon, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface StatusOption {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  badgeClassName?: string;
  menuItemClassName?: string;
}

interface StatusDropdownProps<T extends string> {
  statusConfig: Record<T, StatusOption>;
  currentStatus: T;
  onStatusChange: (newStatus: T) => void;
  align?: "start" | "end";
  disabled?: boolean;
}

function StatusDropdown<T extends string>({
  statusConfig,
  currentStatus,
  onStatusChange,
  align = "start",
  disabled = false,
}: StatusDropdownProps<T>) {
  const current = statusConfig[currentStatus];
  if (!current) return null;
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button type="button" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity outline-none">
          <CurrentIcon className={`h-4 w-4 ${current.iconClassName}`} />
          <Badge variant={current.badgeVariant} className={current.badgeClassName}>
            {current.label}
          </Badge>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[140px]">
        {(Object.entries(statusConfig) as [T, StatusOption][]).map(([key, option]) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={key}
              onSelect={() => onStatusChange(key)}
              className={`gap-2 ${option.menuItemClassName || ""}`}
            >
              <Icon className={`h-4 w-4 ${option.iconClassName}`} />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default StatusDropdown;
