// src/lib/agent/tools/cache.ts
// Cache en memoria con TTL para reducir lecturas a Firestore.
// Los tools del agente usan esto para no releer datos que no cambian frecuentemente.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Default TTL: 3 minutos */
const DEFAULT_TTL_MS = 3 * 60 * 1000;

/**
 * Get cached value or execute the fetcher and cache the result.
 * @param key - Unique cache key
 * @param fetcher - Async function that fetches the data
 * @param ttlMs - Time-to-live in milliseconds (default 3 min)
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const existing = store.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.data as T;
  }

  const data = await fetcher();
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** Clear a specific cache entry */
export function invalidate(key: string): void {
  store.delete(key);
}

/** Clear all cache entries */
export function clearAll(): void {
  store.clear();
}
