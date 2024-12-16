import { type Cache, totalTtl } from "@epic-web/cachified"
import type { Database } from "better-sqlite3"
import { buildCacheKey } from "../cache-key"
import type { CachifiedAdapterSqliteOptions } from "../index"

export function betterSqlite3CacheAdapter<Value = unknown>(
  options: CachifiedAdapterSqliteOptions & {
    database: Database
  },
): Cache<Value> {
  return {
    name: options.name ?? "better-sqlite3",
    get: async (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      const row = options.database
        .prepare(
          `SELECT value, metadata FROM ${options.tableName} WHERE key = ?`,
        )
        .get(cacheKey) as { value: string; metadata: string } | undefined

      if (!row) {
        return null
      }

      const entry = {
        value: JSON.parse(row.value),
        metadata: JSON.parse(row.metadata),
      }

      if (!entry.value) {
        return null
      }

      return entry
    },
    set: async (key, entry) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      const ttl = totalTtl(entry.metadata)

      options.database
        .prepare(
          `INSERT OR REPLACE INTO ${options.tableName} (key, value, metadata) VALUES (?, ?, ?)`,
        )
        .run(
          cacheKey,
          JSON.stringify(entry.value),
          JSON.stringify({
            ...entry.metadata,
            ttl: ttl === Number.POSITIVE_INFINITY ? null : ttl,
          }),
        )

      return entry.value
    },
    delete: async (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      options.database
        .prepare(`DELETE FROM ${options.tableName} WHERE key = ?`)
        .run(cacheKey)
    },
  }
}

export function createBetterSqlite3CacheTable(
  database: Database,
  tableName: string,
) {
  database.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    key TEXT PRIMARY KEY,
    value TEXT,
    metadata TEXT
  )`)
}
