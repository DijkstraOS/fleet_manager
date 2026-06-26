import { applyMapOps, type MapDocument, type MapOp } from "@agv/core";

/**
 * Apply map operations and stamp `updatedAt` — the editor's single map-write
 * primitive. Kept in one place so every edit timestamps the document
 * consistently, whether it is routed through `updateMap` (map-only changes) or
 * folded into an action's atomic `set` alongside selection/status.
 */
export function stampMap(
  map: MapDocument,
  ...ops: Array<MapOp | false | null | undefined>
): MapDocument {
  return { ...applyMapOps(map, ops), updatedAt: new Date().toISOString() };
}
