export function buildCacheKey(key: string, keyPrefix?: string) {
  return keyPrefix ? `${keyPrefix}:${key}` : key
}
