import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  /** Icono principal (default: Inbox) */
  icon?: LucideIcon;
  /** Título breve */
  title: string;
  /** Descripción o sugerencia */
  description?: string;
  /** CTA principal */
  action?: EmptyStateAction;
  /** Tamaño compacto para tablas y listas */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Icon className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
        )}
        {action && (
          <Button
            variant={action.variant ?? "outline"}
            size="sm"
            className="mt-3"
            onClick={action.onClick}
          >
            {action.icon && <action.icon className="h-3.5 w-3.5 mr-1.5" />}
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <div className="rounded-full bg-muted/50 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant ?? "outline"}
          size="sm"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
