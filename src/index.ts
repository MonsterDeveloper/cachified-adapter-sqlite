export * from "./drivers/sqlite3"
export * from "./drivers/sqlite"
export * from "./drivers/better-sqlite3"
export * from "./drivers/bun"
export * from "./drivers/node-sqlite"

/**
 * Common options for all SQLite-based cache adapters
 */
export type CachifiedAdapterSqliteOptions = {
  /** The name of the table to store cache entries */
  tableName: string
  /** Optional prefix to namespace cache keys */
  keyPrefix?: string
  /** Cache adapter name */
  name?: string
}
