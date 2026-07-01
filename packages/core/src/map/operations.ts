import type { MapDocument, MapEdge, MapNode } from "./types";
import { syncMapEdgeTrajectoryEndpoints } from "./trajectory";

/** A pure MapDocument transform. Do NOT stamp `updatedAt` here — the caller stamps once (store's stampMap). */
export type MapOp = (map: MapDocument) => MapDocument;

/** Apply a sequence of operations left-to-right, ignoring falsy entries. */
export function applyMapOps(
  map: MapDocument,
  ops: Array<MapOp | false | null | undefined>
): MapDocument {
  return ops.reduce<MapDocument>((current, op) => (op ? op(current) : current), map);
}

export function appendNode(node: MapNode): MapOp {
  return (map) => ({ ...map, nodes: [...map.nodes, node] });
}

export function appendEdge(edge: MapEdge): MapOp {
  return (map) => ({ ...map, edges: [...map.edges, edge] });
}

/** Remove a node and every edge incident to it. */
export function removeNode(nodeId: string): MapOp {
  return (map) => ({
    ...map,
    nodes: map.nodes.filter((node) => node.id !== nodeId),
    edges: map.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
  });
}

export function removeEdge(edgeId: string): MapOp {
  return (map) => ({ ...map, edges: map.edges.filter((edge) => edge.id !== edgeId) });
}

export function moveNode(nodeId: string, x: number, y: number): MapOp {
  return (map) => {
    const nodes = map.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node));
    return { ...map, nodes, edges: syncMapEdgeTrajectoryEndpoints(map.edges, nodes) };
  };
}

export function replaceNode(previousId: string, next: MapNode): MapOp {
  return (map) => {
    const nodes = map.nodes.map((node) => (node.id === previousId ? next : node));
    const edges = map.edges.map((edge) => ({
      ...edge,
      from: edge.from === previousId ? next.id : edge.from,
      to: edge.to === previousId ? next.id : edge.to,
    }));
    return { ...map, nodes, edges: syncMapEdgeTrajectoryEndpoints(edges, nodes) };
  };
}

export function replaceEdge(edgeId: string, next: MapEdge): MapOp {
  return (map) => ({
    ...map,
    edges: map.edges.map((edge) => (edge.id === edgeId ? next : edge)),
  });
}

/** Splice `replacements` in place of one edge (a no-op when the id is absent). */
export function replaceEdgeWith(edgeId: string, replacements: MapEdge[]): MapOp {
  return (map) => ({
    ...map,
    edges: map.edges.flatMap((edge) => (edge.id === edgeId ? replacements : [edge])),
  });
}
