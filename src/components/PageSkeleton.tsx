import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  variant?: "default" | "cards" | "table";
  className?: string;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted",
        className
      )}
    />
  );
}

export function PageSkeleton({ variant = "default", className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header skeleton */}
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-72" />
      </div>

      {variant === "cards" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-5 space-y-4">
              <div className="flex justify-between">
                <SkeletonBlock className="h-6 w-6 rounded-md" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === "table" && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-muted/30 px-6 py-4">
            <SkeletonBlock className="h-4 w-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-t border-border">
              <SkeletonBlock className="h-4 w-4 rounded-full" />
              <SkeletonBlock className="h-4 flex-1" />
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {variant === "default" && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-5 space-y-3">
                <SkeletonBlock className="h-6 w-6 rounded-md" />
                <SkeletonBlock className="h-4 w-20" />
                <SkeletonBlock className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonBlock className="h-3 w-3 rounded-full" />
                <SkeletonBlock className="h-4 flex-1" />
                <SkeletonBlock className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
