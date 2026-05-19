import { build, context } from "esbuild";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const [entry, outfile, platform = "node", ...flags] = process.argv.slice(2);

if (!entry || !outfile) {
  console.error("Usage: node scripts/bundle-package.mjs <entry> <outfile> [node|neutral] [--external-packages] [--watch]");
  process.exit(1);
}

const watch = flags.includes("--watch");
const externalPackages = flags.includes("--external-packages");
const absoluteOutfile = resolve(outfile);

await mkdir(dirname(absoluteOutfile), { recursive: true });

const options = {
  entryPoints: [resolve(entry)],
  outfile: absoluteOutfile,
  bundle: true,
  format: "esm",
  platform,
  target: "es2022",
  sourcemap: true,
  packages: externalPackages ? "external" : undefined,
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log(`Bundling ${entry} -> ${outfile}`);
} else {
  await build(options);
}
