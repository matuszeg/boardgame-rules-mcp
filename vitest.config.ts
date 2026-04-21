import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/tests/smoke.test.ts",
    ],
    setupFiles: ["./tests/setup.ts"],
    passWithNoTests: true,
  },
});
