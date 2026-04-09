import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** "spinner" = Loader2 centrado, "skeleton" = líneas animadas, "skeleton-table" = filas de tabla */
  variant?: "spinner" | "skeleton" | "skeleton-table";
  /** Mensaje descriptivo debajo del spinner */
  message?: string;
  /** Cantidad de líneas skeleton (default 3) */
  count?: number;
  className?: string;
}

export function LoadingState({
  variant = "spinner",
  message,
  count = 3,
  className,
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (variant === "skeleton-table") {
    return (
      <div className={cn("rounded-xl border border-border overflow-hidden", className)}>
        <div className="bg-muted/30 px-6 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3 border-t border-border">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  // Default: spinner
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      {message && (
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
