import { fileURLToPath } from "node:url"
import dts from "vite-plugin-dts"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  build: {
    target: "esnext",
    minify: false,
    sourcemap: true,
    lib: {
      entry: [
        fileURLToPath(new URL("src/index.ts", import.meta.url)),
        fileURLToPath(new URL("src/drivers/sqlite.ts", import.meta.url)),
        fileURLToPath(new URL("src/drivers/sqlite3.ts", import.meta.url)),
        fileURLToPath(
          new URL("src/drivers/better-sqlite3.ts", import.meta.url),
        ),
        fileURLToPath(new URL("src/drivers/bun.ts", import.meta.url)),
      ],
      name: "cachified-adapter-sqlite",
      formats: ["es"],
    },
  },
  plugins: [
    tsconfigPaths(),
    dts({
      entryRoot: "src",
      exclude: [
        "**/*.test.ts",
        "**/*.test-d.ts",
        "vite.config.ts",
        "scripts",
        "src/__tests__/**/*",
      ],
      rollupTypes: true,
    }),
  ],
  test: {
    include: ["src/**/*.test.ts", "!src/**/bun.test.ts"],
  },
})
