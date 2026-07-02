import type { MapDocument, MapEdge, MapNode } from "./types";
import { getStationNodeIds } from "./selectors";

/**
 * Derived, NOT persisted. Canonical model is the LIF-faithful `nodes[]`/`edges[]`
 * arrays (order is meaningful, `unsupported` round-trips through them); never mutate
 * or persist this index. Rebuild via {@link buildMapIndex} on every map change.
 */
export interface MapIndex {
  nodeById: ReadonlyMap<string, MapNode>;
  edgeById: ReadonlyMap<string, MapEdge>;
  stationNodeIds: ReadonlySet<string>;
}

export function edgeFromToKey(from: string, to: string): string {
  // Length-prefix `from` so an id can't forge the delimiter: 'a'->'b c' and
  // 'a b'->'c' must key distinctly (ids arrive verbatim from LIF import and the
  // inspector, and a collision here resolves a live AGV onto the wrong edge).
  return `${from.length}:${from}:${to}`;
}

export function buildMapIndex(map: MapDocument): MapIndex {
  const nodeById = new Map<string, MapNode>();
  for (const node of map.nodes) nodeById.set(node.id, node);

  const edgeById = new Map<string, MapEdge>();
  for (const edge of map.edges) edgeById.set(edge.id, edge);

  return { nodeById, edgeById, stationNodeIds: getStationNodeIds(map) };
}
