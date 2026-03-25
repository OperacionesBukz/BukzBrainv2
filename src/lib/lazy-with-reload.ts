import { lazy, ComponentType } from "react";

const RELOAD_KEY = "chunk-reload";

export function isChunkLoadError(error: Error): boolean {
  return (
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Importing a module script failed") ||
    error.message.includes("error loading dynamically imported module") ||
    error.name === "ChunkLoadError"
  );
}

/**
 * Wrapper de React.lazy() que recarga la página automáticamente cuando
 * falla la carga de un chunk (típicamente tras un deploy con hashes nuevos).
 * Usa sessionStorage para evitar loops infinitos de recarga.
 */
export function lazyWithReload<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(() =>
    importFn().catch((error: Error) => {
      if (!isChunkLoadError(error)) throw error;

      const hasReloaded = sessionStorage.getItem(RELOAD_KEY);
      if (hasReloaded) {
        sessionStorage.removeItem(RELOAD_KEY);
        throw error;
      }

      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();

      // Promesa que nunca resuelve mientras se recarga
      return new Promise<{ default: T }>(() => {});
    })
  );
}
