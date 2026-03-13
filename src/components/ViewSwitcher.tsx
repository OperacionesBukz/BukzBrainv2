import { ChevronDown, Check, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ViewOption {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface ViewSwitcherProps {
  options: ViewOption[];
  current: string;
  onSwitch: (id: string) => void;
  className?: string;
}

export function ViewSwitcher({ options, current, onSwitch, className }: ViewSwitcherProps) {
  const currentOption = options.find((o) => o.id === current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("transition-all duration-200 ease-out", className)}
        >
          {currentOption?.icon && <currentOption.icon className="h-4 w-4 mr-1.5" />}
          {currentOption?.label}
          <ChevronDown className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => {
          const isActive = option.id === current;
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onSwitch(option.id)}
              className="flex items-center gap-2"
            >
              {option.icon && <option.icon className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{option.label}</span>
              {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
