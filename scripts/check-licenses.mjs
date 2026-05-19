import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const banned = [
  /\bAGPL\b/i,
  /\bGPL\b/i,
  /GNU GENERAL PUBLIC LICENSE/i,
  /GNU AFFERO GENERAL PUBLIC LICENSE/i,
];

const allowedGplMentions = [
  /LGPL/i,
  /UNLICENSED/i,
];

const findings = [];

await scan(join(root, "node_modules"));

if (findings.length > 0) {
  console.error("Rejected GPL/AGPL dependency licenses:");
  for (const finding of findings) {
    console.error(`- ${finding.name}@${finding.version}: ${finding.license} (${finding.path})`);
  }
  process.exit(1);
}

console.log("No GPL/AGPL dependency licenses found.");

async function scan(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.name.startsWith("@")) {
      await scan(full);
      continue;
    }
    await inspectPackage(full);
  }
}

async function inspectPackage(dir) {
  const packagePath = join(dir, "package.json");
  try {
    const json = JSON.parse(await readFile(packagePath, "utf8"));
    const license = normalizeLicense(json.license || json.licenses || "");
    if (isRejected(license)) {
      findings.push({
        name: json.name || "(unknown)",
        version: json.version || "(unknown)",
        license,
        path: packagePath,
      });
    }
  } catch {
    return;
  }

  await scan(join(dir, "node_modules"));
}

function normalizeLicense(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeLicense).join(", ");
  }
  if (typeof value === "object" && value !== null) {
    return normalizeLicense(value.type || value.name || "");
  }
  return String(value || "");
}

function isRejected(license) {
  if (allowedGplMentions.some((pattern) => pattern.test(license))) return false;
  return banned.some((pattern) => pattern.test(license));
}
