import { applyMapOps, type MapDocument, type MapOp } from "@agv/core";

/** Single map-write primitive: route every edit through this so `updatedAt` is stamped consistently. */
export function stampMap(
  map: MapDocument,
  ...ops: Array<MapOp | false | null | undefined>
): MapDocument {
  return { ...applyMapOps(map, ops), updatedAt: new Date().toISOString() };
}
