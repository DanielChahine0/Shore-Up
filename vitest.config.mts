import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"] },
  resolve: {
    alias: {
      // "server-only" throws outside a Next server build; tests run the same code in plain Node.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(import.meta.dirname),
    },
  },
});
