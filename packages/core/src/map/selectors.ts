import type { MapDocument } from "./types";

/**
 * Derive the set of "action/station" node ids from LIF data preserved in the
 * model's `unsupported` records. This adds no model fields — it reads the same
 * standard data that LIF import round-trips through `unsupported`.
 *
 * A node counts as an action/station node when EITHER:
 *  (a) its `unsupported.vehicleTypeNodeProperties[]` has an entry with a
 *      non-empty `actions` array, OR
 *  (b) it appears in some `unsupported.stations[].interactionNodeIds` on the map.
 *
 * Pure: no I/O, no mutation.
 */
export function getActionNodeIds(map: MapDocument): ReadonlySet<string> {
  const actionNodeIds = new Set<string>(getStationNodeIds(map));

  // Rule (a): nodes that carry their own actions.
  for (const node of map.nodes) {
    if (nodeHasActions(node.unsupported)) actionNodeIds.add(node.id);
  }

  return actionNodeIds;
}

/**
 * Derive the set of node ids referenced as a station interaction point — rule
 * (b) of {@link getActionNodeIds} on its own. A node is a "station node" when it
 * appears in some `unsupported.stations[].interactionNodeIds` on the map.
 *
 * Unlike {@link getActionNodeIds} this does NOT include nodes that merely carry
 * their own actions: a node with actions but no station reference is not a
 * station node. Use this for gating that must distinguish station membership
 * from action membership.
 *
 * Pure: no I/O, no mutation.
 */
export function getStationNodeIds(map: MapDocument): ReadonlySet<string> {
  const stationNodeIds = new Set<string>();

  for (const station of mapStations(map.unsupported)) {
    for (const nodeId of stationInteractionNodeIds(station)) {
      stationNodeIds.add(nodeId);
    }
  }

  return stationNodeIds;
}

/**
 * How a node's ID may be edited, derived LIVE from its current relationships —
 * not a persisted flag. Recompute whenever relationships change.
 *
 *  - `"editable"`              — no edges/routes/stations reference it; edit freely.
 *  - `"editable-with-edge-warning"` — edges reference it (but no routes/stations);
 *    `replaceNode` cascades the rename onto incident edges, so editing is safe
 *    after a confirmation warning.
 *  - `"locked"`               — a route or station references it; those don't
 *    cascade on rename, so the ID is uneditable.
 */
export type NodeIdEditPolicy = "editable" | "editable-with-edge-warning" | "locked";

export function nodeIdEditPolicy(relationships: {
  hasEdges: boolean;
  isStationReferenced: boolean;
  isRouteReferenced: boolean;
}): NodeIdEditPolicy {
  if (relationships.isStationReferenced || relationships.isRouteReferenced) return "locked";
  if (relationships.hasEdges) return "editable-with-edge-warning";
  return "editable";
}

function nodeHasActions(unsupported: Record<string, unknown> | undefined): boolean {
  const properties = toArray(unsupported?.vehicleTypeNodeProperties);
  return properties.some((property) => {
    if (!isRecord(property)) return false;
    return toArray(property.actions).length > 0;
  });
}

function mapStations(unsupported: Record<string, unknown> | undefined): unknown[] {
  return toArray(unsupported?.stations);
}

function stationInteractionNodeIds(station: unknown): string[] {
  if (!isRecord(station)) return [];
  return toArray(station.interactionNodeIds).filter(
    (id): id is string => typeof id === "string"
  );
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
