import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError } from "@/lib/lazy-with-reload";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

const RELOAD_KEY = "chunk-reload";

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);

    if (isChunkLoadError(error)) {
      const hasReloaded = sessionStorage.getItem(RELOAD_KEY);
      if (!hasReloaded) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.state.isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
            <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-4">
              <RefreshCw className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                Actualización disponible
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Se ha publicado una nueva versión. Recarga la página para obtener la última actualización.
              </p>
            </div>
            <Button
              onClick={() => {
                sessionStorage.removeItem(RELOAD_KEY);
                window.location.reload();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar página
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Algo salió mal
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Ocurrió un error inesperado. Intenta recargar la página o volver al inicio.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground/60 font-mono mt-2">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
            <Button onClick={() => window.location.assign("/BukzBrainv2/dashboard")}>
              Ir al inicio
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
