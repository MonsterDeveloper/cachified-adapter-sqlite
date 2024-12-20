import { type Cache, totalTtl } from "@epic-web/cachified"
import type { Database } from "better-sqlite3"
import { buildCacheKey } from "../cache-key"
import type { CachifiedAdapterSqliteOptions } from "../index"

/**
 * Creates a better-sqlite3 cache adapter for use with cachified
 *
 * @param options - {@linkcode CachifiedAdapterSqliteOptions} plus a database instance
 * @param options.database - The better-sqlite3 database instance
 * @param options.tableName - Name of the table to store cache entries
 * @param options.keyPrefix - Optional prefix to namespace cache keys
 * @param options.name - Optional name for the cache adapter
 * @returns A Cache instance that stores data in SQLite using better-sqlite3
 */
export function betterSqlite3CacheAdapter<Value = unknown>(
  options: CachifiedAdapterSqliteOptions & {
    database: Database
  },
): Cache<Value> {
  // Prepare statements
  const getStatement = options.database.prepare(
    `SELECT value, metadata FROM ${options.tableName} WHERE key = ?`,
  )
  const setStatement = options.database.prepare(
    `INSERT OR REPLACE INTO ${options.tableName} (key, value, metadata) VALUES (?, ?, ?)`,
  )
  const deleteStatement = options.database.prepare(
    `DELETE FROM ${options.tableName} WHERE key = ?`,
  )

  return {
    name: options.name ?? "better-sqlite3",
    get: (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      const row = getStatement.get(cacheKey) as
        | { value: string; metadata: string }
        | undefined

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

      setStatement.run(
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

      deleteStatement.run(cacheKey)
    },
  }
}

/**
 * Creates a cache table in the SQLite database if it doesn't already exist
 *
 * @param database - The better-sqlite3 Database instance
 * @param tableName - Name of the cache table to create
 */
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
