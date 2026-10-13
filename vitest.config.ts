import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/database/**", "tests/browser/**", "tests/*.database.test.ts"],
    mockReset: true,
    restoreMocks: true,
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
});
