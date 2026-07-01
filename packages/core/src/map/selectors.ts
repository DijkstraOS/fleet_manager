import type { MapDocument, MapNode } from "./types";

/** Node ids referenced by any station's `unsupported.stations[].interactionNodeIds`. */
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
 * Whether a node carries a non-empty label. A blank label (empty or whitespace)
 * reads as "unlabeled" — the marker that, combined with having no actions, makes
 * a node a pure path-support node. Exported so the renderer can decide whether to
 * draw the label text at all.
 *
 * Pure: no I/O, no mutation.
 */
export function nodeHasLabel(node: MapNode): boolean {
  return (node.label ?? "").trim().length > 0;
}

/**
 * Derive the set of "support" node ids — pure path-support nodes that carry no
 * action/station role and no label.
 */
export function getSupportNodeIds(map: MapDocument): ReadonlySet<string> {
  const stationNodeIds = getStationNodeIds(map);
  const supportNodeIds = new Set<string>();

  for (const node of map.nodes) {
    if (isSupportNode(node, stationNodeIds)) {
      supportNodeIds.add(node.id);
    }
  }

  return supportNodeIds;
}

/** Pass stationNodeIds in (build once via {@link getStationNodeIds}) so a per-node check never rebuilds a whole-map Set. */
export function isActionNode(node: MapNode, stationNodeIds: ReadonlySet<string>): boolean {
  return nodeHasActions(node.unsupported) || stationNodeIds.has(node.id);
}

export function isSupportNode(node: MapNode, stationNodeIds: ReadonlySet<string>): boolean {
  return !nodeHasLabel(node) && !isActionNode(node, stationNodeIds);
}

/** editable-with-edge-warning is safe because replaceNode cascades the rename onto edges; routes/stations don't cascade, so they lock. */
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
