import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
  },
});
