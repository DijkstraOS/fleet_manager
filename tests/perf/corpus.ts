import { DEFAULT_CANVAS_SIZE, type MapDocument, type MapEdge, type MapNode } from "@agv/core";

/** Keep generation O(N) so it never dominates the measurement; `dense` is unavoidably O(N^2), so use small N. */

export type Topology =
  | "grid" // realistic factory floor — the natural scaling shape
  | "dense" // dense: near-complete graph — stresses the O(E·N) join hardest (small N only)
  | "hub" // hub: stresses adjacency / incident-edge paths
  | "chain"; // stresses route-resolution depth

export interface MakeMapOptions {
  nodes: number;
  topology?: Topology;
  /** Rightward neighbours per node for "grid" (default 1); ignored by all other topologies. */
  edgesPerNode?: number;
  bidirectional?: boolean;
}

// Fixed (not `new Date()`) so generation stays deterministic.
const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

// metres
const SPACING = 1;
const FLOOR_PADDING = 2;

export function makeMap(options: MakeMapOptions): MapDocument {
  const count = Math.max(0, Math.floor(options.nodes));
  const topology = options.topology ?? "grid";
  const bidirectional = options.bidirectional ?? true;
  const reach = Math.max(1, Math.floor(options.edgesPerNode ?? 1));

  const built =
    topology === "grid"
      ? buildGrid(count, reach, bidirectional)
      : topology === "dense"
        ? buildDense(count, bidirectional)
        : topology === "hub"
          ? buildHub(count, bidirectional)
          : buildChain(count, bidirectional);

  return assemble(`perf-${topology}-${count}`, built.nodes, built.edges);
}

// --- topologies -------------------------------------------------------------

interface Built {
  nodes: MapNode[];
  edges: MapEdge[];
}

function buildGrid(count: number, reach: number, bidirectional: boolean): Built {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i += 1) {
    nodes.push(node(i, (i % cols) * SPACING, Math.floor(i / cols) * SPACING));
  }
  const edges: MapEdge[] = [];
  const link = linker(edges, bidirectional);
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    for (let k = 1; k <= reach && col + k < cols && i + k < count; k += 1) link(i, i + k);
    // Keep one downward link only: degree-bounded so E grows linearly with N.
    if (i + cols < count) link(i, i + cols);
  }
  return { nodes, edges };
}

function buildChain(count: number, bidirectional: boolean): Built {
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i += 1) nodes.push(node(i, i * SPACING, 0));
  const edges: MapEdge[] = [];
  const link = linker(edges, bidirectional);
  for (let i = 0; i + 1 < count; i += 1) link(i, i + 1);
  return { nodes, edges };
}

function buildHub(count: number, bidirectional: boolean): Built {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i += 1) {
    nodes.push(node(i, (i % cols) * SPACING, Math.floor(i / cols) * SPACING));
  }
  const edges: MapEdge[] = [];
  const link = linker(edges, bidirectional);
  for (let i = 1; i < count; i += 1) link(0, i);
  return { nodes, edges };
}

function buildDense(count: number, bidirectional: boolean): Built {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i += 1) {
    nodes.push(node(i, (i % cols) * SPACING, Math.floor(i / cols) * SPACING));
  }
  const edges: MapEdge[] = [];
  const link = linker(edges, bidirectional);
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) link(i, j);
  }
  return { nodes, edges };
}

// --- element factories ------------------------------------------------------

// Keep empty labels (every 3rd node) — they exercise the support-dot render/classification branch.
function node(index: number, x: number, y: number): MapNode {
  return {
    id: `n${index}`,
    label: index % 3 === 0 ? "" : `Node ${index}`,
    x,
    y,
  };
}

function edge(fromId: string, toId: string): MapEdge {
  return {
    id: `${fromId}->${toId}`,
    label: `${fromId} -> ${toId}`,
    from: fromId,
    to: toId,
    maxSpeed: 1.5,
    orientationType: "TANGENTIAL",
    rotationAllowed: true,
    trajectory: null,
  };
}

function linker(edges: MapEdge[], bidirectional: boolean): (a: number, b: number) => void {
  return (a, b) => {
    edges.push(edge(`n${a}`, `n${b}`));
    if (bidirectional) edges.push(edge(`n${b}`, `n${a}`));
  };
}

// Size the floor from the content so all nodes fit — a fixed size would fail validateMap for large maps.
function assemble(id: string, nodes: MapNode[], edges: MapEdge[]): MapDocument {
  let maxX = 0;
  let maxY = 0;
  for (const item of nodes) {
    if (item.x > maxX) maxX = item.x;
    if (item.y > maxY) maxY = item.y;
  }
  const canvas =
    nodes.length === 0
      ? { ...DEFAULT_CANVAS_SIZE }
      : { width: maxX + FLOOR_PADDING, height: maxY + FLOOR_PADDING };
  return {
    id,
    name: id,
    version: "1",
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    canvas,
    nodes,
    edges,
  };
}
