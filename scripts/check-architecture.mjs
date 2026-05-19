import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const coreRoot = new URL("../packages/core/src", import.meta.url);
const serverRoot = new URL("../apps/server/src", import.meta.url);
const simulatorRoot = new URL("../apps/simulator/src", import.meta.url);
const webRoot = new URL("../apps/web/src", import.meta.url);
const testsRoot = new URL("../tests", import.meta.url);
const forbiddenImports = [
  "fastify",
  "@fastify/cors",
  "mqtt",
  "aedes",
  "ws",
  "react",
  "react-dom",
  "zustand",
  "node:fs",
  "node:path",
  "node:http",
  "node:net",
  "node:module",
];
const forbiddenCoreSimulationTerms = [
  "SimulatedAgv",
  "createSimulatedAgv",
  "advanceAgv",
  "buildState",
  "buildVisualization",
];

const violations = [];

for (const root of [coreRoot, serverRoot, simulatorRoot, webRoot, testsRoot]) {
  for (const file of await listFiles(root.pathname)) {
    if (!isSourceFile(file)) continue;
    const source = await readFile(file, "utf8");
    const relativeJsImportPattern = /\b(?:from\s+|import\(\s*)["']\.{1,2}\/[^"']+\.js["']/;
    if (relativeJsImportPattern.test(source)) {
      violations.push(`${file}: relative source imports must not use .js extensions`);
    }
  }
}

for (const file of await listFiles(coreRoot.pathname)) {
  if (!isSourceFile(file)) continue;
  const source = await readFile(file, "utf8");
  for (const forbiddenImport of forbiddenImports) {
    const importPattern = new RegExp(`from\\s+["']${escapeRegExp(forbiddenImport)}(?:/[^"']*)?["']|import\\(["']${escapeRegExp(forbiddenImport)}(?:/[^"']*)?["']\\)`);
    if (importPattern.test(source)) {
      violations.push(`${file}: forbidden core import "${forbiddenImport}"`);
    }
  }
  for (const term of forbiddenCoreSimulationTerms) {
    if (source.includes(term)) {
      violations.push(`${file}: simulator motion/state logic belongs in apps/simulator, not @agv/core`);
    }
  }
}

for (const root of [serverRoot, simulatorRoot]) {
  for (const file of await listFiles(root.pathname)) {
    if (!isSourceFile(file)) continue;
    const source = await readFile(file, "utf8");
    if (/(^|\n)\s*(export\s+)?(abstract\s+)?class\s+[A-Z][A-Za-z0-9_]*/.test(source)) {
      violations.push(`${file}: app-defined classes are not allowed in server or simulator source`);
    }
  }
}

for (const file of await listFiles(webRoot.pathname)) {
  if (!file.endsWith("View.tsx")) continue;
  const source = await readFile(file, "utf8");
  for (const forbiddenImport of [
    "zustand",
    "stores/",
    "services/api",
    "services/realtime",
  ]) {
    if (source.includes(forbiddenImport)) {
      violations.push(`${file}: view components cannot import "${forbiddenImport}"`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Architecture check passed.");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSourceFile(file) {
  return file.endsWith(".ts") || file.endsWith(".tsx");
}
