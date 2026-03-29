import { auth } from "@/lib/firebase";

interface ResilientFetchOptions extends RequestInit {
  retries?: number;
  retryDelays?: number[];
  timeout?: number;
  skipAuth?: boolean;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAYS = [1000, 3000];
const DEFAULT_TIMEOUT = 15_000;

const RETRYABLE_STATUS = new Set([502, 503, 504]);

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Si no hay usuario logueado, no agregamos header
  }
  return {};
}

export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelays = DEFAULT_RETRY_DELAYS,
    timeout = DEFAULT_TIMEOUT,
    skipAuth = false,
    ...fetchOptions
  } = options;

  // Inyectar token Firebase automáticamente
  if (!skipAuth) {
    const authHeaders = await getAuthHeaders();
    fetchOptions.headers = {
      ...authHeaders,
      ...fetchOptions.headers,
    };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Merge abort signal — respect caller's signal too
    const originalSignal = fetchOptions.signal;
    if (originalSignal?.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const onExternalAbort = () => controller.abort();
    originalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      originalSignal?.removeEventListener("abort", onExternalAbort);

      if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
        const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
        console.warn(
          `[resilientFetch] ${response.status} en ${url}, reintentando en ${delay}ms (${attempt + 1}/${retries})`,
        );
        await sleep(delay);
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      originalSignal?.removeEventListener("abort", onExternalAbort);

      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof DOMException && err.name === "AbortError" && !originalSignal?.aborted);

      if (isNetworkError && attempt < retries) {
        const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
        const reason = err instanceof DOMException ? "timeout" : "red";
        console.warn(
          `[resilientFetch] Error de ${reason} en ${url}, reintentando en ${delay}ms (${attempt + 1}/${retries})`,
        );
        await sleep(delay);
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }

      // If the caller aborted, propagate immediately
      if (err instanceof DOMException && err.name === "AbortError" && originalSignal?.aborted) {
        throw err;
      }

      // Wrap timeout as a clearer message
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new TypeError(
          `La solicitud a ${new URL(url).pathname} excedió el tiempo límite (${timeout / 1000}s).`,
        );
      }

      throw err;
    }
  }

  throw lastError ?? new Error(`Error de conexión con ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
