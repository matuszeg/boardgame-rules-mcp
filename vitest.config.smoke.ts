import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/tests/smoke.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./tests/setup.ts"],
  },
});
