import type { MapDocument } from "./types";

export function nextNodeId(map: MapDocument): string {
  let index = map.nodes.length + 1;
  while (map.nodes.some((node) => node.id === `n-${index}`)) index += 1;
  return `n-${index}`;
}

export function nextEdgeId(map: MapDocument, from: string, to: string): string {
  const base = `${from}-${to}`;
  if (!map.edges.some((edgeItem) => edgeItem.id === base)) return base;
  let index = 2;
  while (map.edges.some((edgeItem) => edgeItem.id === `${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
