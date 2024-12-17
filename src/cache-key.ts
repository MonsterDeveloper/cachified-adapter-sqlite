/**
 * Composes a cache key by optionally prefixing it with a namespace
 *
 * @param key - The base cache key
 * @param keyPrefix - Optional prefix to namespace the cache key
 * @returns The final cache key, either prefixed (`prefix:key`) or unchanged
 */
export function buildCacheKey(key: string, keyPrefix?: string) {
  return keyPrefix ? `${keyPrefix}:${key}` : key
}
