export type OrientationType = "GLOBAL" | "TANGENTIAL";

export interface EdgeTrajectory {
  degree: number;
  knotVector: number[];
  controlPoints: Array<{
    x: number;
    y: number;
    weight?: number;
  }>;
}

export interface MapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  theta?: number;
  unsupported?: Record<string, unknown>;
}

export interface MapEdge {
  id: string;
  label: string;
  from: string;
  to: string;
  maxSpeed?: number;
  orientation?: number;
  orientationType: OrientationType;
  rotationAllowed: boolean;
  trajectory: EdgeTrajectory | null;
  unsupported?: Record<string, unknown>;
}

/**
 * The finite factory floor the map lives on, in meters. The floor spans world
 * `(0,0)` (top-left origin) to `(width, height)`, with +X right / +Y down — the
 * same orientation the simulator and trajectory headings already assume, so no
 * axis is ever flipped. All valid node coordinates are non-negative.
 */
export interface CanvasSize {
  width: number;
  height: number;
}

export interface MapDocument {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  canvas: CanvasSize;
  nodes: MapNode[];
  edges: MapEdge[];
  unsupported?: Record<string, unknown>;
}

export interface RouteDocument {
  id: string;
  mapId: string;
  name: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
}
