import type { CacheMetadata } from "@epic-web/cachified"
import { Database } from "sqlite3"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { buildCacheKey } from "../cache-key"
import {
  createSqlite3CacheTable,
  sqlite3CacheAdapter,
} from "../drivers/sqlite3"

let database: Database

beforeAll(async () => {
  database = new Database(":memory:")

  await new Promise<void>((resolve, reject) => {
    database.run(
      "CREATE TABLE cache1 (key TEXT PRIMARY KEY, value TEXT, metadata TEXT)",
      (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      },
    )
  })
})

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    database.run("DELETE FROM cache1", (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
})

afterAll(() => {
  database.close()
})

describe("sqlite3CacheAdapter", () => {
  it("has a name", () => {
    expect(sqlite3CacheAdapter({ database, tableName: "cache1" }).name).toBe(
      "sqlite3",
    )
  })

  describe("get", () => {
    it("returns null for a non-existent key", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })

      const result = await adapter.get("non-existent-key")

      expect(result).toBeNull()
    })

    it("gets a non-nullish value correctly", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })

      const value = {
        foo: "bar",
        baz: "123",
      }

      const metadata: CacheMetadata = {
        ttl: 1234,
        createdTime: new Date().getTime(),
      }

      await new Promise<void>((resolve, reject) => {
        database.run(
          "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
          "test-key",
          JSON.stringify(value),
          JSON.stringify(metadata),
          (error: Error | null) => {
            if (error) {
              reject(error)
              return
            }
            resolve()
          },
        )
      })

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value, metadata })
    })

    it("gets correct value with prefix", async () => {
      const adapter = sqlite3CacheAdapter({
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

      await new Promise<void>((resolve, reject) => {
        database.run(
          "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
          buildCacheKey("test-key", "iamaprefix"),
          JSON.stringify(value),
          JSON.stringify(metadata),
          (error: Error | null) => {
            if (error) {
              reject(error)
              return
            }
            resolve()
          },
        )
      })

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value, metadata })
    })

    it("handles JSON stringified non-JSON values", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })

      const stringValue = "Non-JSON string"
      const stringifiedValue = JSON.stringify(stringValue)
      const metadata: CacheMetadata = {
        ttl: 1234,
        createdTime: new Date().getTime(),
      }

      await new Promise<void>((resolve, reject) => {
        database.run(
          "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
          "test-key",
          stringifiedValue,
          JSON.stringify(metadata),
          (error: Error | null) => {
            if (error) {
              reject(error)
              return
            }
            resolve()
          },
        )
      })

      const result = await adapter.get("test-key")

      expect(result).toEqual({ value: stringValue, metadata })
    })

    it("throws an error for non-stringified non-JSON values", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })

      const nonJsonValue = "Non-JSON string"

      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
      }

      await new Promise<void>((resolve, reject) => {
        database.run(
          "INSERT INTO cache1 (key, value, metadata) VALUES (?, ?, ?)",
          "non-json-key",
          nonJsonValue,
          JSON.stringify(metadata),
          (error: Error | null) => {
            if (error) {
              reject(error)
              return
            }
            resolve()
          },
        )
      })

      await expect(adapter.get("non-json-key")).rejects.toThrow()
    })
  })

  describe("set", () => {
    it("stores a value with no key prefix", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })
      const value = { foo: "bar" }
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 0,
      }

      await adapter.set("test-key", { value, metadata })

      const result = await new Promise<{ value: string; metadata: string }>(
        (resolve, reject) => {
          database.get(
            "SELECT value, metadata FROM cache1 WHERE key = ?",
            "test-key",
            (error, row) => {
              if (error) {
                reject(error)
                return
              }
              resolve(row as { value: string; metadata: string })
            },
          )
        },
      )

      expect(JSON.parse(result.value)).toEqual(value)
      expect(JSON.parse(result.metadata)).toEqual(metadata)
    })

    it("stores a value with a key prefix", async () => {
      const adapter = sqlite3CacheAdapter({
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

      const result = await new Promise<{ value: string; metadata: string }>(
        (resolve, reject) => {
          database.get(
            "SELECT value, metadata FROM cache1 WHERE key = ?",
            "prefix:test-key",
            (error, row) => {
              if (error) {
                reject(error)
                return
              }
              resolve(row as { value: string; metadata: string })
            },
          )
        },
      )

      expect(JSON.parse(result.value)).toEqual(value)
      expect(JSON.parse(result.metadata)).toEqual(metadata)
    })

    it("handles non-JSON values", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })
      const value = "simple string"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 1234,
      }

      await adapter.set("test-key", { value, metadata })

      const result = await new Promise<{ value: string; metadata: string }>(
        (resolve, reject) => {
          database.get(
            "SELECT value, metadata FROM cache1 WHERE key = ?",
            "test-key",
            (error, row) => {
              if (error) {
                reject(error)
                return
              }
              resolve(row as { value: string; metadata: string })
            },
          )
        },
      )

      expect(JSON.parse(result.value)).toBe(value)
      expect(JSON.parse(result.metadata)).toEqual(metadata)
    })

    it("handles Infinity ttl", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })
      const value = "simple string"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: Number.POSITIVE_INFINITY,
      }

      await adapter.set("test-key", { value, metadata })

      const result = await new Promise<{ value: string; metadata: string }>(
        (resolve, reject) => {
          database.get(
            "SELECT value, metadata FROM cache1 WHERE key = ?",
            "test-key",
            (error, row) => {
              if (error) {
                reject(error)
                return
              }
              resolve(row as { value: string; metadata: string })
            },
          )
        },
      )

      expect(JSON.parse(result.value)).toBe(value)
      expect(JSON.parse(result.metadata)).toEqual({
        createdTime: metadata.createdTime,
        ttl: null,
      })
    })
  })

  describe("delete", () => {
    it("deletes a value with no key prefix", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })
      const value = "test value"
      const metadata: CacheMetadata = {
        createdTime: new Date().getTime(),
        ttl: 1000,
      }

      await adapter.set("test-key", { value, metadata })
      await adapter.delete("test-key")

      const result = await new Promise<
        { value: string; metadata: string } | undefined
      >((resolve, reject) => {
        database.get(
          "SELECT value, metadata FROM cache1 WHERE key = ?",
          "test-key",
          (error, row) => {
            if (error) {
              reject(error)
              return
            }
            resolve(row as { value: string; metadata: string })
          },
        )
      })

      expect(result).toBeUndefined()
    })

    it("deletes a value with a key prefix", async () => {
      const adapter = sqlite3CacheAdapter({
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

      const result = await new Promise<
        { value: string; metadata: string } | undefined
      >((resolve, reject) => {
        database.get(
          "SELECT value, metadata FROM cache1 WHERE key = ?",
          "prefix:test-key",
          (error, row) => {
            if (error) {
              reject(error)
              return
            }
            resolve(row as { value: string; metadata: string })
          },
        )
      })

      expect(result).toBeUndefined()
    })

    it("handles deletion of non-existent keys gracefully", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })

      const deletePromise = adapter.delete("non-existent-key")

      await expect(deletePromise).resolves.toBeUndefined()
    })

    it("does not affect other keys when deleting a specific key", async () => {
      const adapter = sqlite3CacheAdapter({ database, tableName: "cache1" })
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

describe("createCacheTable", () => {
  it("creates a table if it doesn't exist", async () => {
    await createSqlite3CacheTable(database, "test_table")

    const result = await new Promise<{ name: string }[]>((resolve, reject) => {
      database.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
        (error, rows) => {
          if (error) {
            reject(error)
            return
          }

          resolve(rows as never)
        },
      )
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("test_table")
  })

  it("doesn't create a table if it exists", async () => {
    const initialResult = await new Promise<{ name: string }[]>(
      (resolve, reject) => {
        database.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
          (error, rows) => {
            if (error) {
              reject(error)
              return
            }

            resolve(rows as never)
          },
        )
      },
    )

    await createSqlite3CacheTable(database, "cache1")

    const finalResult = await new Promise<{ name: string }[]>(
      (resolve, reject) => {
        database.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='cache1'",
          (error, rows) => {
            if (error) {
              reject(error)
              return
            }

            resolve(rows as never)
          },
        )
      },
    )

    expect(finalResult).toHaveLength(1)
    expect(finalResult).toEqual(initialResult)
  })
})
