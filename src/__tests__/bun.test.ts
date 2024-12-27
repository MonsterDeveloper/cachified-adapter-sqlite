import { Database } from "bun:sqlite"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test"
import type { CacheMetadata } from "@epic-web/cachified"
import { buildCacheKey } from "../cache-key"
import {
  bunSqliteCacheAdapter,
  createBunSqliteCacheTable,
} from "../drivers/bun"

let database: Database

beforeAll(() => {
  database = new Database(":memory:")
  database.run(
    "CREATE TABLE cache1 (key TEXT PRIMARY KEY, value TEXT, metadata TEXT)",
  )
})

afterEach(() => {
  database.query("DELETE FROM cache1").run()
})

afterAll(() => {
  database.close()
})

describe("bunSqliteCacheAdapter", () => {
  it("has a name", () => {
    expect(bunSqliteCacheAdapter({ database, tableName: "cache1" }).name).toBe(
      "bun-sqlite",
    )
  })

  describe("get", () => {
    it("returns null for a non-existent key", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      const result = await adapter.get("non-existent-key")

      expect(result).toBeNull()
    })

    it("gets a non-nullish value correctly", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      const value = {
        foo: "bar",
        baz: "123",
      }

      const metadata: CacheMetadata = {
        ttl: 1234,
        createdTime: Date.now(),
      }

      database
        .query("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run("test-key", JSON.stringify(value), JSON.stringify(metadata))

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value, metadata })
    })

    it("gets correct value with prefix", async () => {
      const adapter = bunSqliteCacheAdapter({
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
        createdTime: Date.now(),
      }

      database
        .query("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run(
          buildCacheKey("test-key", "iamaprefix"),
          JSON.stringify(value),
          JSON.stringify(metadata),
        )

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value, metadata })
    })

    it("handles JSON stringified non-JSON values", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      const stringValue = "Non-JSON string"
      const stringifiedValue = JSON.stringify(stringValue)
      const metadata: CacheMetadata = {
        ttl: 1234,
        createdTime: Date.now(),
      }

      database
        .query("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run("test-key", stringifiedValue, JSON.stringify(metadata))

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value: stringValue, metadata })
    })

    it("throws an error for non-stringified non-JSON values", () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      const nonJsonValue = "Non-JSON string"

      const metadata: CacheMetadata = {
        createdTime: Date.now(),
      }

      database
        .query("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run("non-json-key", nonJsonValue, JSON.stringify(metadata))

      expect(() => adapter.get("non-json-key")).toThrow()
    })
  })

  describe("set", () => {
    it("stores a value with no key prefix", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })
      const value = "simple string"
      const metadata: CacheMetadata = {
        createdTime: Date.now(),
        ttl: 1234,
      }

      await adapter.set("test-key", { value, metadata })

      const result = database
        .query("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("test-key") as { value: string; metadata: string }

      expect(JSON.parse(result.value)).toBe(value)
      expect(JSON.parse(result.metadata)).toEqual(metadata)
    })

    it("stores a value with a key prefix", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
        keyPrefix: "prefix",
      })
      const value = { foo: "bar" }
      const metadata: CacheMetadata = {
        createdTime: Date.now(),
        ttl: 0,
      }

      await adapter.set("test-key", { value, metadata })

      const result = database
        .query("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("prefix:test-key") as { value: string; metadata: string }

      expect(JSON.parse(result.value)).toEqual(value)
      expect(JSON.parse(result.metadata)).toEqual(metadata)
    })

    it("handles Infinity ttl", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })
      const value = "simple string"
      const metadata: CacheMetadata = {
        createdTime: Date.now(),
        ttl: Number.POSITIVE_INFINITY,
      }

      await adapter.set("test-key", { value, metadata })

      const result = database
        .query("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("test-key") as { value: string; metadata: string }

      expect(JSON.parse(result.value)).toBe(value)
      expect(JSON.parse(result.metadata)).toEqual({
        createdTime: metadata.createdTime,
        ttl: null,
      })
    })
  })

  describe("delete", () => {
    it("deletes a value with no key prefix", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })
      const value = "test value"
      const metadata: CacheMetadata = {
        createdTime: Date.now(),
        ttl: 1000,
      }

      await adapter.set("test-key", { value, metadata })
      await adapter.delete("test-key")

      const result = database
        .query("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("test-key") as { value: string; metadata: string } | undefined

      expect(result).toBeNull()
    })

    it("deletes a value with a key prefix", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
        keyPrefix: "prefix:",
      })
      const value = "test value"
      const metadata: CacheMetadata = {
        createdTime: Date.now(),
        ttl: 1000,
      }

      await adapter.set("test-key", { value, metadata })
      await adapter.delete("test-key")

      const result = database
        .query("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("prefix:test-key") as
        | { value: string; metadata: string }
        | undefined

      expect(result).toBeNull()
    })

    it("handles deletion of non-existent keys gracefully", () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      expect(adapter.delete("non-existent-key")).toBeUndefined()
    })

    it("does not affect other keys when deleting a specific key", async () => {
      const adapter = bunSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })
      const value1 = "test value 1"
      const value2 = "test value 2"
      const metadata: CacheMetadata = {
        createdTime: Date.now(),
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

describe("createBunSqliteCacheTable", () => {
  it("creates a table if it doesn't exist", () => {
    createBunSqliteCacheTable(database, "test_table")

    const result = database
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
      )
      .all() as { name: string }[]

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("test_table")
  })

  it("doesn't create a table if it exists", () => {
    const initialResult = database
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
      )
      .all() as { name: string }[]

    createBunSqliteCacheTable(database, "cache1")

    const finalResult = database
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
      )
      .all() as { name: string }[]

    expect(finalResult).toHaveLength(1)
    expect(finalResult).toEqual(initialResult)
  })
})
