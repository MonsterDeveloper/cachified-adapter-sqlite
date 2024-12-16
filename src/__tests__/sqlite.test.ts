import type { CacheMetadata } from "@epic-web/cachified"
import { type Database, open } from "sqlite"
import sqlite3 from "sqlite3"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { buildCacheKey } from "../cache-key"
import { createSqliteCacheTable, sqliteCacheAdapter } from "../drivers/sqlite"

let database: Database

beforeAll(async () => {
  database = await open({
    filename: ":memory:",
    driver: sqlite3.Database,
  })

  await database.exec(
    "CREATE TABLE cache1 (key TEXT PRIMARY KEY, value TEXT, metadata TEXT)",
  )
})

afterEach(async () => {
  await database.run("DELETE FROM cache1")
})

afterAll(() => {
  database.close()
})

describe("sqliteCacheAdapter", () => {
  it("has a name", () => {
    expect(sqliteCacheAdapter({ database, tableName: "cache1" }).name).toBe(
      "sqlite",
    )
  })

  describe("get", () => {
    it("returns null for a non-existent key", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })

      const result = await adapter.get("non-existent-key")

      expect(result).toBeNull()
    })

    it("gets a non-nullish value correctly", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })

      const value = {
        foo: "bar",
        baz: "123",
      }

      const metadata: CacheMetadata = {
        ttl: 1234,
        createdTime: new Date().getTime(),
      }

      await database.run(
        "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
        "test-key",
        JSON.stringify(value),
        JSON.stringify(metadata),
      )

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value, metadata })
    })

    it("gets correct value with prefix", async () => {
      const adapter = sqliteCacheAdapter({
        database,
        tableName: "cache1",
        keyPrefix: "iamaprefix",
      })

      const value = {
        foo: "bar",
        baz: "123",
      }

      const metadata: CacheMetadata = {
        ttl: 1234,
        createdTime: new Date().getTime(),
      }

      await database.run(
        "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
        buildCacheKey("test-key", "iamaprefix"),
        JSON.stringify(value),
        JSON.stringify(metadata),
      )

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value, metadata })
    })

    it("handles JSON stringified non-JSON values", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })

      const stringValue = "Non-JSON string"
      const stringifiedValue = JSON.stringify(stringValue)
      const metadata: CacheMetadata = {
        ttl: 1234,
        createdTime: new Date().getTime(),
      }

      await database.run(
        "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
        "test-key",
        stringifiedValue,
        JSON.stringify(metadata),
      )

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value: stringValue, metadata })
    })

    it("throws an error for non-stringified non-JSON values", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })

      const nonJsonValue = "Non-JSON string"

      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
      }

      await database.run(
        "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
        "non-json-key",
        nonJsonValue,
        JSON.stringify(metadata),
      )

      await expect(adapter.get("non-json-key")).rejects.toThrow()
    })
  })

  describe("set", () => {
    it("stores a value with no key prefix", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })
      const value = { foo: "bar" }
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 0,
      }

      await adapter.set("test-key", { value, metadata })

      const row = await database.get<{ value: string; metadata: string }>(
        "SELECT value, metadata FROM cache1 WHERE key = ?",
        "test-key",
      )

      if (!row) {
        throw new Error("Expected row to exist")
      }

      expect(JSON.parse(row.value)).toEqual(value)
      expect(JSON.parse(row.metadata)).toEqual(metadata)
    })

    it("stores a value with a key prefix", async () => {
      const adapter = sqliteCacheAdapter({
        database,
        tableName: "cache1",
        keyPrefix: "prefix",
      })
      const value = { foo: "bar" }
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 0,
      }

      await adapter.set("test-key", { value, metadata })

      const row = await database.get<{ value: string; metadata: string }>(
        "SELECT value, metadata FROM cache1 WHERE key = ?",
        "prefix:test-key",
      )

      if (!row) {
        throw new Error("Expected row to exist")
      }

      expect(JSON.parse(row.value)).toEqual(value)
      expect(JSON.parse(row.metadata)).toEqual(metadata)
    })

    it("handles non-JSON values", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })
      const value = "simple string"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 1234,
      }

      await adapter.set("test-key", { value, metadata })

      const row = await database.get<{ value: string; metadata: string }>(
        "SELECT value, metadata FROM cache1 WHERE key = ?",
        "test-key",
      )

      if (!row) {
        throw new Error("Expected row to exist")
      }

      expect(JSON.parse(row.value)).toBe(value)
      expect(JSON.parse(row.metadata)).toEqual(metadata)
    })

    it("handles Infinity ttl", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })
      const value = "simple string"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: Number.POSITIVE_INFINITY,
      }

      await adapter.set("test-key", { value, metadata })

      const row = await database.get<{ value: string; metadata: string }>(
        "SELECT value, metadata FROM cache1 WHERE key = ?",
        "test-key",
      )

      if (!row) {
        throw new Error("Expected row to exist")
      }

      expect(JSON.parse(row.value)).toBe(value)
      expect(JSON.parse(row.metadata)).toEqual({
        createdTime: metadata.createdTime,
        ttl: null,
      })
    })
  })

  describe("delete", () => {
    it("deletes a value with no key prefix", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })
      const value = "test value"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 1000,
      }

      await adapter.set("test-key", { value, metadata })
      await adapter.delete("test-key")

      const row = await database.get<{ value: string; metadata: string }>(
        "SELECT value, metadata FROM cache1 WHERE key = ?",
        "test-key",
      )

      expect(row).toBeUndefined()
    })

    it("deletes a value with a key prefix", async () => {
      const adapter = sqliteCacheAdapter({
        database,
        tableName: "cache1",
        keyPrefix: "prefix:",
      })
      const value = "test value"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 1000,
      }

      await adapter.set("test-key", { value, metadata })
      await adapter.delete("test-key")

      const row = await database.get<{ value: string; metadata: string }>(
        "SELECT value, metadata FROM cache1 WHERE key = ?",
        "prefix:test-key",
      )

      expect(row).toBeUndefined()
    })

    it("handles deletion of non-existent keys gracefully", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })

      const deletePromise = adapter.delete("non-existent-key")

      await expect(deletePromise).resolves.toBeUndefined()
    })

    it("does not affect other keys when deleting a specific key", async () => {
      const adapter = sqliteCacheAdapter({ database, tableName: "cache1" })
      const value1 = "test value 1"
      const value2 = "test value 2"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 1000,
      }

      await adapter.set("key-1", { value: value1, metadata })
      await adapter.set("key-2", { value: value2, metadata })

      await adapter.delete("key-1")

      const result = await adapter.get("key-2")
      expect(result?.value).toBe(value2)
    })
  })
})

describe("createSqliteCacheTable", () => {
  it("creates a table if it doesn't exist", async () => {
    await createSqliteCacheTable(database, "test_table")

    const rows = await database.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe("test_table")
  })

  it("doesn't create a table if it exists", async () => {
    const initialRows = await database.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
    )

    await createSqliteCacheTable(database, "cache1")

    const finalRows = await database.all<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
    )

    expect(finalRows).toHaveLength(1)
    expect(finalRows).toEqual(initialRows)
  })
})
