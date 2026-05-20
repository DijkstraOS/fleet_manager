import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RouteDocument } from "@agv/core";
import type { RouteRepository } from "../domain/ports";

export function createFileRouteRepository(filePath = resolve(process.cwd(), "data/routes.json")): RouteRepository {
  let routes = new Map<string, RouteDocument>();

  async function save() {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      `${JSON.stringify(Array.from(routes.values()), null, 2)}\n`,
      "utf8"
    );
  }

  return {
    load: async () => {
      try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as RouteDocument[];
        routes = new Map(parsed.map((route) => [route.id, route]));
      } catch {
        routes = new Map();
        await save();
      }
    },

    list: (mapId) => Array.from(routes.values())
      .filter((route) => !mapId || route.mapId === mapId)
      .sort((left, right) => left.name.localeCompare(right.name)),

    get: (id) => routes.get(id),

    upsert: async (route) => {
      const now = new Date().toISOString();
      const existing = routes.get(route.id);
      const next: RouteDocument = {
        ...route,
        createdAt: existing?.createdAt || route.createdAt || now,
        updatedAt: now,
      };
      routes.set(next.id, next);
      await save();
      return next;
    },

    delete: async (id) => {
      const deleted = routes.delete(id);
      if (deleted) await save();
      return deleted;
    },
  };
}
