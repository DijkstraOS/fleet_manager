import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { MapDocument } from "@agv/core";
import { createDemoMap, validateMap } from "@agv/core";

export class MapStore {
  private filePath: string;
  private maps = new Map<string, MapDocument>();

  constructor(filePath = resolve(process.cwd(), "data/maps.json")) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as MapDocument[];
      this.maps = new Map(parsed.map((map) => [map.id, map]));
    } catch {
      const demo = createDemoMap();
      this.maps = new Map([[demo.id, demo]]);
      await this.save();
    }
  }

  list() {
    return Array.from(this.maps.values()).map((map) => ({
      id: map.id,
      name: map.name,
      version: map.version,
      updatedAt: map.updatedAt,
      nodes: map.nodes.length,
      edges: map.edges.length,
    }));
  }

  get(id: string) {
    return this.maps.get(id);
  }

  async upsert(map: MapDocument) {
    const issues = validateMap(map);
    if (issues.length > 0) {
      throw new Error(issues.map((issue) => issue.message).join(" "));
    }
    const now = new Date().toISOString();
    const existing = this.maps.get(map.id);
    const next: MapDocument = {
      ...map,
      createdAt: existing?.createdAt || map.createdAt || now,
      updatedAt: now,
    };
    this.maps.set(next.id, next);
    await this.save();
    return next;
  }

  private async save() {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      `${JSON.stringify(Array.from(this.maps.values()), null, 2)}\n`,
      "utf8"
    );
  }
}
