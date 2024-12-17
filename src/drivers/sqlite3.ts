import { type Cache, totalTtl } from "@epic-web/cachified"
import type { Database } from "sqlite3"
import { buildCacheKey } from "../cache-key"
import type { CachifiedAdapterSqliteOptions } from "../index"

/**
 * Creates a sqlite3 cache adapter for use with cachified
 *
 * @param options - {@linkcode CachifiedAdapterSqliteOptions} plus a database instance
 * @param options.database - The sqlite3 database instance
 * @param options.tableName - Name of the table to store cache entries
 * @param options.keyPrefix - Optional prefix to namespace cache keys
 * @param options.name - Optional name for the cache adapter
 * @returns A Cache instance that stores data in SQLite using sqlite3
 */
export function sqlite3CacheAdapter<Value = unknown>(
  options: CachifiedAdapterSqliteOptions & {
    database: Database
  },
): Cache<Value> {
  return {
    name: options.name ?? "sqlite3",
    get: async (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      return new Promise((resolve, reject) => {
        options.database.get(
          `SELECT value, metadata FROM ${options.tableName} WHERE key = ?`,
          cacheKey,
          (
            error: Error | null,
            row: { value: string; metadata: string } | undefined,
          ) => {
            if (error) {
              reject(error)
              return
            }

            if (!row) {
              resolve(null)
              return
            }

            try {
              const entry = {
                value: JSON.parse(row.value),
                metadata: JSON.parse(row.metadata),
              }

              if (!entry.value) {
                resolve(null)
                return
              }

              resolve(entry)
            } catch (error) {
              reject(error)
            }
          },
        )
      })
    },
    set: async (key, entry) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      const ttl = totalTtl(entry.metadata)

      return new Promise<Value>((resolve, reject) => {
        options.database.run(
          `INSERT OR REPLACE INTO ${options.tableName} (key, value, metadata) VALUES (?, ?, ?)`,
          cacheKey,
          JSON.stringify(entry.value),
          JSON.stringify({
            ...entry.metadata,
            ttl: ttl === Number.POSITIVE_INFINITY ? null : ttl,
          }),
          (error: Error | null) => {
            if (error) {
              reject(error)
              return
            }

            resolve(entry.value)
          },
        )
      })
    },
    delete: async (key) => {
      const cacheKey = buildCacheKey(key, options.keyPrefix)

      return new Promise((resolve, reject) => {
        options.database.run(
          `DELETE FROM ${options.tableName} WHERE key = ?`,
          cacheKey,
          (error: Error | null) => {
            if (error) {
              reject(error)
              return
            }
            resolve(undefined)
          },
        )
      })
    },
  }
}

/**
 * Creates a cache table in the SQLite database if it doesn't already exist
 *
 * @param database - The sqlite3 Database instance
 * @param tableName - Name of the cache table to create
 */
export async function createSqlite3CacheTable(
  database: Database,
  tableName: string,
) {
  return new Promise<void>((resolve, reject) => {
    database.run(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
      key TEXT PRIMARY KEY,
      value TEXT,
      metadata TEXT
    )`,
      (error: Error | null) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      },
    )
  })
}
