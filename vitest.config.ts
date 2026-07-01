import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Share the perf corpus/probes across root (node) and web (jsdom) tests without
    // deep relative paths. See tests/perf/README.md.
    alias: {
      "@perf": new URL("./tests/perf", import.meta.url).pathname,
    },
  },
  test: {
    // `.tsx` picks up the Pillar B render-budget suite; `tests/perf` picks up Pillars A & C.
    // Default environment stays node — render tests opt into jsdom per-file via
    // `// @vitest-environment jsdom`, so the pure-logic suites keep the fast path.
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.ts",
      "tests/server/**/*.test.ts",
      "tests/perf/**/*.test.ts",
    ],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
  },
});
