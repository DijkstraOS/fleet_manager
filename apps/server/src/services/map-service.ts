import { exportLifDocument } from "@agv/core";
import type { MapHandlers, MapRepository, RealtimePublisher } from "../domain/ports";

export function createMapHandlers(
  repository: MapRepository,
  realtime: RealtimePublisher
): MapHandlers {
  return {
    listMaps: () => repository.list(),
    getMap: (id) => repository.get(id),
    saveMap: async (map) => {
      const saved = await repository.upsert(map);
      realtime.broadcast({ type: "map_updated", map: saved });
      return saved;
    },
    exportLif: (id) => {
      const map = repository.get(id);
      return map ? exportLifDocument(map) : undefined;
    },
  };
}
