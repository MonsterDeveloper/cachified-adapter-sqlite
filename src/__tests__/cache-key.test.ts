import { describe, expect, it } from "vitest"
import { buildCacheKey } from "../cache-key"

describe("buildCacheKey", () => {
  it("builds a cache key without prefix", () => {
    expect(buildCacheKey("foo")).toBe("foo")
  })

  it("builds a cache key with prefix", () => {
    expect(buildCacheKey("foo", "bar")).toBe("bar:foo")
  })
})
