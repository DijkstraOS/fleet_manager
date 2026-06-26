import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { backfillCanvas, createDemoMap, validateMap, type MapDocument } from "@agv/core";
import type { MapRepository } from "../domain/ports";

export function createFileMapRepository(filePath = resolve(process.cwd(), "data/maps.json")): MapRepository {
  let maps = new Map<string, MapDocument>();

  async function save() {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      `${JSON.stringify(Array.from(maps.values()), null, 2)}\n`,
      "utf8"
    );
  }

  return {
    load: async () => {
      try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as MapDocument[];
        // Back-compat: maps saved before the finite-floor primitive lack a `canvas`,
        // so they are backfilled to the 200x200 default and uniformly recentered onto
        // the floor center (headings unchanged). The field then sticks on the next
        // save, and a map that already has a `canvas` is left exactly as stored.
        maps = new Map(parsed.map((map) => {
          const normalized = backfillCanvas(map);
          return [normalized.id, normalized];
        }));
      } catch {
        const demo = createDemoMap();
        maps = new Map([[demo.id, demo]]);
        await save();
      }
    },

    list: () => Array.from(maps.values()).map((map) => ({
      id: map.id,
      name: map.name,
      version: map.version,
      updatedAt: map.updatedAt,
      nodes: map.nodes.length,
      edges: map.edges.length,
    })),

    get: (id) => maps.get(id),

    upsert: async (map) => {
      const issues = validateMap(map);
      if (issues.length > 0) {
        throw new Error(issues.map((issue) => issue.message).join(" "));
      }
      const now = new Date().toISOString();
      const existing = maps.get(map.id);
      const next: MapDocument = {
        ...map,
        createdAt: existing?.createdAt || map.createdAt || now,
        updatedAt: now,
      };
      maps.set(next.id, next);
      await save();
      return next;
    },
  };
}
