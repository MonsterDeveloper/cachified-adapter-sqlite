import { type Cache, totalTtl } from "@epic-web/cachified"
import type { Database } from "sqlite"
import { buildCacheKey } from "../cache-key"
import type { CachifiedAdapterSqliteOptions } from "../index"

/**
 * Creates a sqlite cache adapter for use with cachified
 *
 * @param options - {@linkcode CachifiedAdapterSqliteOptions} plus a database instance
 * @param options.database - The sqlite database instance
 * @param options.tableName - Name of the table to store cache entries
 * @param options.keyPrefix - Optional prefix to namespace cache keys
 * @param options.name - Optional name for the cache adapter
 * @returns A Cache instance that stores data in SQLite using sqlite
 */
export function sqliteCacheAdapter<Value = unknown>(
  options: CachifiedAdapterSqliteOptions & {
    database: Database
  },
): Cache<Value> {
  return {
    name: options.name ?? "sqlite",
    get: async (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      const row = await options.database.get<{
        value: string
        metadata: string
      }>(
        `SELECT value, metadata FROM ${options.tableName} WHERE key = ?`,
        cacheKey,
      )

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

      await options.database.run(
        `INSERT OR REPLACE INTO ${options.tableName} (key, value, metadata) VALUES (?, ?, ?)`,
        [
          cacheKey,
          JSON.stringify(entry.value),
          JSON.stringify({
            ...entry.metadata,
            ttl: ttl === Number.POSITIVE_INFINITY ? null : ttl,
          }),
        ],
      )

      return entry.value
    },
    delete: async (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)
      await options.database.run(
        `DELETE FROM ${options.tableName} WHERE key = ?`,
        cacheKey,
      )
    },
  }
}

/**
 * Creates a cache table in the SQLite database if it doesn't already exist
 *
 * @param database - The sqlite Database instance
 * @param tableName - Name of the cache table to create
 */
export function createSqliteCacheTable(database: Database, tableName: string) {
  return database.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    key TEXT PRIMARY KEY,
    value TEXT,
    metadata TEXT
  )`)
}
