# cachified-adapter-sqlite

[![npm](https://img.shields.io/npm/v/cachified-adapter-sqlite)](https://npmjs.com/package/cachified-adapter-sqlite)
[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/MonsterDeveloper/cachified-adapter-sqlite/publish.yml)](https://github.com/MonsterDeveloper/cachified-adapter-sqlite/actions/workflows/publish.yml)
[![GitHub License](https://img.shields.io/github/license/MonsterDeveloper/cachified-adapter-sqlite)](https://github.com/MonsterDeveloper/cachified-adapter-sqlite/blob/main/LICENSE)

`cachified-adapter-sqlite` is an adapter for [@epic-web/cachified](https://github.com/epic-web/cachified) that allows you to use SQLite as a cache backend.

It supports [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3), [`sqlite`](https://github.com/kriasoft/node-sqlite), [`sqlite3`](https://github.com/TryGhost/node-sqlite3), and [`bun:sqlite`](https://bun.sh/docs/api/sqlite).


## Installation

Install the package and `@epic-web/cachified` (if you haven't already — it's a peer dependency).

<img height="18" src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons/npm.svg"> npm

```bash
npm i cachified-adapter-sqlite @epic-web/cachified
```
<details>
  <summary>Other package managers</summary>

  <img height="18" src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons/pnpm.svg"> pnpm

  ```bash
  pnpm add cachified-adapter-sqlite @epic-web/cachified
  ```

  <img height="18" src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons/yarn.svg"> Yarn

  ```bash
  yarn add cachified-adapter-sqlite @epic-web/cachified
  ```

  <img height="18" src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons/bun.svg"> bun

  ```bash
  bun add cachified-adapter-sqlite @epic-web/cachified
  ```
</details>

## Usage

```ts
import { cachified } from "@epic-web/cachified"

import { betterSqlite3CacheAdapter, createBetterSqlite3CacheTable } from "cachified-adapter-sqlite/better-sqlite3" // better-sqlite3
import Database from "better-sqlite3"
// ---- OR ----
import { sqliteCacheAdapter, createSqliteCacheTable } from "cachified-adapter-sqlite/sqlite" // sqlite
import { sqlite3CacheAdapter, createSqlite3CacheTable } from "cachified-adapter-sqlite/sqlite3" // sqlite3
import { bunSqliteCacheAdapter, createBunSqliteCacheTable } from "cachified-adapter-sqlite/bun" // bun:sqlite

const TABLE_NAME = "cache"
const database = new Database(":memory:") // create a database using your library of choice

createBetterSqlite3CacheTable(database, TABLE_NAME)

const cache = betterSqlite3CacheAdapter({
  database,
  tableName: TABLE_NAME,
  keyPrefix: "my-app", // optionally specify a key prefix
  name: "my-app-cache", // optionally specify a cache name
})

export async function getUserById(id: number) {
  return cachified({
    key: `user-${id}`,
    cache,
    async getFreshValue() {
      const response = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`)
      return response.json() as Promise<Record<string, unknown>>
    },
    ttl: 60_000, // 1 minute
    staleWhileRevalidate: 300_000, // 5 minutes
  })
}
```

## Many thanks to

Kent C. Dodds and contributors for the [@epic-web/cachified](https://github.com/epic-web/cachified) library, and to Adishwar Rishi for his inspirational [cachified-adapter-cloudflare-kv](https://github.com/AdiRishi/cachified-adapter-cloudflare-kv)