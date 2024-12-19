import type { Database } from "bun:sqlite"
import { type Cache, totalTtl } from "@epic-web/cachified"
import { buildCacheKey } from "../cache-key"
import type { CachifiedAdapterSqliteOptions } from "../index"

/**
 * Creates a Bun SQLite cache adapter for use with cachified
 *
 * @param options - {@linkcode CachifiedAdapterSqliteOptions} plus a database instance
 * @param options.database - The Bun SQLite database instance
 * @param options.tableName - Name of the table to store cache entries
 * @param options.keyPrefix - Optional prefix to namespace cache keys
 * @param options.name - Optional name for the cache adapter
 * @returns A Cache instance that stores data in SQLite using Bun's SQLite driver
 */
export function bunSqliteCacheAdapter<Value = unknown>(
  options: CachifiedAdapterSqliteOptions & {
    database: Database
  },
): Cache<Value> {
  return {
    name: options.name ?? "bun-sqlite",
    get: (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      const row = options.database
        .query(`SELECT value, metadata FROM ${options.tableName} WHERE key = ?`)
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
    set: (key, entry) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      const ttl = totalTtl(entry.metadata)

      options.database
        .query(
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
    delete: (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      options.database
        .query(`DELETE FROM ${options.tableName} WHERE key = ?`)
        .run(cacheKey)
    },
  }
}

/**
 * Creates a cache table in the SQLite database if it doesn't already exist
 *
 * @param database - The Bun SQLite Database instance
 * @param tableName - Name of the cache table to create
 */
export function createBunSqliteCacheTable(
  database: Database,
  tableName: string,
) {
  database.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
    key TEXT PRIMARY KEY,
    value TEXT,
    metadata TEXT
  )`)
}
