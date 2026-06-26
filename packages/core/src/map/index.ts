import type { MapDocument, MapEdge, MapNode, RouteDocument, ValidationIssue } from "./types";
import { DEFAULT_CANVAS_SIZE } from "./canvas";
import { validateTrajectory } from "./trajectory";

export function createEmptyMap(name = "Untitled Map"): MapDocument {
  const now = new Date().toISOString();
  return {
    id: slugify(name) || "map",
    name,
    version: "1",
    createdAt: now,
    updatedAt: now,
    canvas: { ...DEFAULT_CANVAS_SIZE },
    nodes: [],
    edges: [],
  };
}

// The demo grid is authored around the origin (bbox (0,0)->(15,10)) then shifted
// so its bounding box centers on the 200x200 floor (center (100,100)).
const DEMO_OFFSET_X = 92.5;
const DEMO_OFFSET_Y = 95;

export function createDemoMap(): MapDocument {
  const now = new Date().toISOString();
  return {
    id: "demo-grid",
    name: "Demo Grid",
    version: "1",
    createdAt: now,
    updatedAt: now,
    canvas: { ...DEFAULT_CANVAS_SIZE },
    nodes: [
      demoNode("dock-a", "Dock A", 0, 0),
      demoNode("corr-1", "Corridor 1", 5, 0),
      demoNode("corr-2", "Corridor 2", 10, 0),
      demoNode("dock-b", "Dock B", 15, 0),
      demoNode("mat-a", "Material A", 0, 6),
      demoNode("corr-3", "Corridor 3", 5, 6),
      demoNode("corr-4", "Corridor 4", 10, 6),
      demoNode("mat-b", "Material B", 15, 6),
      demoNode("drop", "Drop", 7.5, 10),
    ],
    edges: [
      edge("dock-a", "corr-1"),
      edge("corr-1", "dock-a"),
      edge("corr-1", "corr-2"),
      edge("corr-2", "corr-1"),
      edge("corr-2", "dock-b"),
      edge("dock-b", "corr-2"),
      edge("mat-a", "corr-3"),
      edge("corr-3", "mat-a"),
      edge("corr-3", "corr-4"),
      edge("corr-4", "corr-3"),
      edge("corr-4", "mat-b"),
      edge("mat-b", "corr-4"),
      edge("corr-1", "corr-3"),
      edge("corr-3", "corr-1"),
      edge("corr-2", "corr-4"),
      edge("corr-4", "corr-2"),
      edge("corr-3", "drop", 1.2),
      edge("drop", "corr-3", 1.2),
      edge("corr-4", "drop", 1.2),
      edge("drop", "corr-4", 1.2),
    ],
  };
}

function demoNode(id: string, label: string, x: number, y: number): MapNode {
  return { id, label, x: x + DEMO_OFFSET_X, y: y + DEMO_OFFSET_Y };
}

function edge(from: string, to: string, maxSpeed = 1.5): MapEdge {
  return {
    id: `${from}-${to}`,
    label: `${from} -> ${to}`,
    from,
    to,
    maxSpeed,
    orientationType: "TANGENTIAL",
    rotationAllowed: true,
    trajectory: null,
  };
}

export function validateMap(map: MapDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (!map.id.trim()) {
    issues.push({ code: "map.id.empty", message: "Map id is required." });
  }

  if (!map.canvas || !(map.canvas.width > 0) || !(map.canvas.height > 0)) {
    issues.push({ code: "map.canvas.invalid", message: "Map canvas width and height must be positive." });
  }

  for (const node of map.nodes) {
    if (!node.id.trim()) {
      issues.push({ code: "node.id.empty", message: "Node id is required." });
      continue;
    }
    if (nodeIds.has(node.id)) {
      issues.push({ code: "node.id.duplicate", message: `Duplicate node id: ${node.id}` });
    }
    nodeIds.add(node.id);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      issues.push({ code: "node.position.invalid", message: `Node ${node.id} has an invalid position.` });
    }
  }

  for (const edgeItem of map.edges) {
    if (!edgeItem.id.trim()) {
      issues.push({ code: "edge.id.empty", message: "Edge id is required." });
      continue;
    }
    if (edgeIds.has(edgeItem.id)) {
      issues.push({ code: "edge.id.duplicate", message: `Duplicate edge id: ${edgeItem.id}` });
    }
    edgeIds.add(edgeItem.id);
    if (!nodeIds.has(edgeItem.from)) {
      issues.push({ code: "edge.from.missing", message: `Edge ${edgeItem.id} starts at missing node ${edgeItem.from}.` });
    }
    if (!nodeIds.has(edgeItem.to)) {
      issues.push({ code: "edge.to.missing", message: `Edge ${edgeItem.id} ends at missing node ${edgeItem.to}.` });
    }
    if (edgeItem.maxSpeed !== undefined && edgeItem.maxSpeed <= 0) {
      issues.push({ code: "edge.maxSpeed.invalid", message: `Edge ${edgeItem.id} max speed must be positive.` });
    }
    for (const message of validateTrajectory(edgeItem)) {
      issues.push({ code: "edge.trajectory.invalid", message });
    }
  }

  return issues;
}

export function findNode(map: MapDocument, nodeId: string): MapNode | undefined {
  return map.nodes.find((node) => node.id === nodeId);
}

export function findEdge(map: MapDocument, from: string, to: string): MapEdge | undefined {
  return map.edges.find((edgeItem) => edgeItem.from === from && edgeItem.to === to);
}

export function findEdgeById(map: MapDocument, edgeId: string): MapEdge | undefined {
  return map.edges.find((edgeItem) => edgeItem.id === edgeId);
}

export function validateRoute(map: MapDocument, routeNodeIds: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (routeNodeIds.length < 2) {
    issues.push({ code: "route.short", message: "Route needs at least two nodes." });
    return issues;
  }

  for (const nodeId of routeNodeIds) {
    if (!findNode(map, nodeId)) {
      issues.push({ code: "route.node.missing", message: `Route references missing node ${nodeId}.` });
    }
  }

  for (let index = 0; index < routeNodeIds.length - 1; index += 1) {
    const from = routeNodeIds[index];
    const to = routeNodeIds[index + 1];
    if (from && to && !findEdge(map, from, to)) {
      issues.push({ code: "route.edge.missing", message: `No directed edge from ${from} to ${to}.` });
    }
  }

  return issues;
}

export function validateRouteDocument(map: MapDocument | undefined, route: RouteDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!route.id.trim()) {
    issues.push({ code: "route.id.empty", message: "Route id is required." });
  }
  if (!route.name.trim()) {
    issues.push({ code: "route.name.empty", message: "Route name is required." });
  }
  if (!map) {
    issues.push({ code: "route.map.missing", message: `Route map ${route.mapId} was not found.` });
    return issues;
  }
  if (route.mapId !== map.id) {
    issues.push({ code: "route.map.mismatch", message: `Route ${route.id} belongs to map ${route.mapId}, not ${map.id}.` });
  }

  return [...issues, ...validateRoute(map, route.nodeIds)];
}

export function nextRouteId(routes: RouteDocument[], name: string): string {
  const base = slugify(name) || "route";
  if (!routes.some((route) => route.id === base)) return base;
  let index = 2;
  while (routes.some((route) => route.id === `${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type { CanvasSize, EdgeTrajectory, MapDocument, MapEdge, MapNode, OrientationType, RouteDocument, ValidationIssue } from "./types";
export * from "./ids";
export * from "./trajectory";
export * from "./operations";
export * from "./selectors";
export * from "./canvas";
