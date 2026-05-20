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

export interface MapDocument {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
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
