import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const target = process.argv[2];

if (!target) {
  console.error("Usage: node scripts/clean-dist.mjs <dist-dir>");
  process.exit(1);
}

const absoluteTarget = resolve(target);

if (!absoluteTarget.endsWith("/dist")) {
  console.error(`Refusing to clean non-dist path: ${absoluteTarget}`);
  process.exit(1);
}

await rm(absoluteTarget, { recursive: true, force: true });
await rm(resolve(dirname(absoluteTarget), "tsconfig.tsbuildinfo"), { force: true });
