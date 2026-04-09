import { AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Título del error (default: "Algo salió mal") */
  title?: string;
  /** Descripción legible del error */
  message?: string;
  /** Detalle técnico (se muestra en mono, más pequeño) */
  detail?: string;
  /** Callback para reintentar */
  onRetry?: () => void;
  /** Texto del botón retry (default: "Reintentar") */
  retryLabel?: string;
  /** Icono personalizado (default: AlertTriangle) */
  icon?: LucideIcon;
  /** Tamaño compacto para tablas y listas */
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Algo salió mal",
  message = "Ocurrió un error inesperado. Intenta de nuevo.",
  detail,
  onRetry,
  retryLabel = "Reintentar",
  icon: Icon = AlertTriangle,
  compact = false,
  className,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Icon className="h-5 w-5 text-destructive/70 mx-auto mb-2" />
        <p className="text-sm text-destructive">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <Icon className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">{message}</p>
      {detail && (
        <p className="text-xs text-muted-foreground/60 font-mono mt-2 max-w-md text-center">
          {detail}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
