/**
 * Architecture boundary checker — the canonical, enforced home for the project's
 * dependency rules. Run with `npm run architecture:check`.
 *
 * Each rule below carries the *why*, so the rationale lives in code rather than in a
 * separate doc. When a tightening issue (see docs/issues/) graduates into a permanent
 * rule, encode it here and delete the issue file. `docs/architecture.md` points here for
 * the rule details instead of restating them.
 *
 * Rules:
 *  1. @agv/core is framework-free (no fastify/mqtt/aedes/ws/react/zustand/node builtins),
 *     so the shared domain runs unchanged in browser, Node, and tests.
 *  2. Simulator motion/state logic stays out of core — core models the map and orders,
 *     not how one dummy AGV happens to move.
 *  3. apps/server and apps/simulator define no classes — functional composition keeps
 *     wiring explicit and avoids hidden lifecycle/`this` state.
 *  4. Web *View.tsx components are presentational — no zustand/stores/services imports,
 *     so Views stay prop-driven and trivially testable.
 *  5. No `.js` extensions on relative source imports anywhere.
 *  6. Edge/trajectory geometry stays in @agv/core — web stores may call it but must not
 *     re-declare it, so domain math doesn't drift back into the UI layer.
 */
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
// Rule 6: edge/trajectory geometry lives in @agv/core, not in web stores. Stores may CALL
// these (imported from @agv/core); only re-DECLARING one here is a layering regression. The
// pattern anchors on a declaration keyword + the identifier, so references/imports are allowed.
const storesRoot = new URL("../apps/web/src/stores", import.meta.url);
const forbiddenStoreTrajectoryDefinition =
  /(?:function|const|let)\s+(splitEdge|splitQuadraticTrajectory|copyBifurcatedEdgeProperties|resetReverseEdgeToSelectedCurvePath|edgesShareQuadraticHandle)\b/;

const violations = [];

// Rule 5: relative source imports must not carry .js extensions.
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

// Rules 1 & 2: core stays framework-free and free of simulator motion/state logic.
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

// Rule 3: server and simulator use functional composition, not classes.
for (const root of [serverRoot, simulatorRoot]) {
  for (const file of await listFiles(root.pathname)) {
    if (!isSourceFile(file)) continue;
    const source = await readFile(file, "utf8");
    if (/(^|\n)\s*(export\s+)?(abstract\s+)?class\s+[A-Z][A-Za-z0-9_]*/.test(source)) {
      violations.push(`${file}: app-defined classes are not allowed in server or simulator source`);
    }
  }
}

// Rule 4: *View.tsx components are presentational — no store/service/zustand imports.
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

// Rule 6: edge/trajectory geometry must not be re-declared inside web stores.
for (const file of await listFiles(storesRoot.pathname)) {
  if (!isSourceFile(file)) continue;
  const source = await readFile(file, "utf8");
  if (forbiddenStoreTrajectoryDefinition.test(source)) {
    violations.push(`${file}: edge/trajectory geometry belongs in @agv/core, not in a web store (import it instead of redefining)`);
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
