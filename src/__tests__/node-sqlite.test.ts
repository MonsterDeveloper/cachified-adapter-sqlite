import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { after, afterEach, before, describe, it } from "node:test"
import type { CacheMetadata } from "@epic-web/cachified"
import { buildCacheKey } from "../cache-key"
import {
  createNodeSqliteCacheTable,
  nodeSqliteCacheAdapter,
} from "../drivers/node-sqlite"

let database: DatabaseSync

before(() => {
  database = new DatabaseSync(":memory:")
  database.exec(
    "CREATE TABLE cache1 (key TEXT PRIMARY KEY, value TEXT, metadata TEXT)",
  )
})

afterEach(() => {
  database.exec("DELETE FROM cache1")
})

after(() => {
  database.close()
})

describe("nodeSqliteCacheAdapter", () => {
  it("has a name", () => {
    assert.strictEqual(
      nodeSqliteCacheAdapter({ database, tableName: "cache1" }).name,
      "node-sqlite",
    )
  })

  describe("get", () => {
    it("returns null for a non-existent key", async () => {
      const adapter = nodeSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      const result = await adapter.get("non-existent-key")

      assert.strictEqual(result, null)
    })

    it("gets a non-nullish value correctly", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run("test-key", JSON.stringify(value), JSON.stringify(metadata))

      const result = await adapter.get("test-key")

      assert.deepStrictEqual(result, { value, metadata })
    })

    it("gets correct value with prefix", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run(
          buildCacheKey("test-key", "iamaprefix"),
          JSON.stringify(value),
          JSON.stringify(metadata),
        )

      const result = await adapter.get("test-key")

      assert.deepStrictEqual(result, { value, metadata })
    })

    it("handles JSON stringified non-JSON values", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run("test-key", stringifiedValue, JSON.stringify(metadata))

      const result = await adapter.get("test-key")

      assert.deepStrictEqual(result, { value: stringValue, metadata })
    })

    it("throws an error for non-stringified non-JSON values", async () => {
      const adapter = nodeSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      const nonJsonValue = "Non-JSON string"

      const metadata: CacheMetadata = {
        createdTime: Date.now(),
      }

      database
        .prepare("INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)")
        .run("non-json-key", nonJsonValue, JSON.stringify(metadata))

      await assert.rejects(async () => {
        await adapter.get("non-json-key")
      })
    })
  })

  describe("set", () => {
    it("stores a value with no key prefix", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("test-key") as { value: string; metadata: string }

      assert.strictEqual(JSON.parse(result.value), value)
      assert.deepStrictEqual(JSON.parse(result.metadata), metadata)
    })

    it("stores a value with a key prefix", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("prefix:test-key") as { value: string; metadata: string }

      assert.deepStrictEqual(JSON.parse(result.value), value)
      assert.deepStrictEqual(JSON.parse(result.metadata), metadata)
    })

    it("handles Infinity ttl", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("test-key") as { value: string; metadata: string }

      assert.strictEqual(JSON.parse(result.value), value)
      assert.deepStrictEqual(JSON.parse(result.metadata), {
        createdTime: metadata.createdTime,
        ttl: null,
      })
    })
  })

  describe("delete", () => {
    it("deletes a value with no key prefix", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("test-key") as { value: string; metadata: string } | undefined

      assert.strictEqual(result, undefined)
    })

    it("deletes a value with a key prefix", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
        .prepare("SELECT value, metadata FROM cache1 WHERE key = ?")
        .get("prefix:test-key") as
        | { value: string; metadata: string }
        | undefined

      assert.strictEqual(result, undefined)
    })

    it("handles deletion of non-existent keys gracefully", () => {
      const adapter = nodeSqliteCacheAdapter({
        database,
        tableName: "cache1",
      })

      assert.strictEqual(adapter.delete("non-existent-key"), undefined)
    })

    it("does not affect other keys when deleting a specific key", async () => {
      const adapter = nodeSqliteCacheAdapter({
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
      assert.strictEqual(result?.value, value2)
    })
  })
})

describe("createNodeSqliteCacheTable", () => {
  it("creates a table if it doesn't exist", () => {
    createNodeSqliteCacheTable(database, "test_table")

    const result = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
      )
      .all() as { name: string }[]

    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0]?.name, "test_table")
  })

  it("doesn't create a table if it exists", () => {
    const initialResult = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
      )
      .all() as { name: string }[]

    createNodeSqliteCacheTable(database, "cache1")

    const finalResult = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
      )
      .all() as { name: string }[]

    assert.strictEqual(finalResult.length, 1)
    assert.deepStrictEqual(finalResult, initialResult)
  })
})
