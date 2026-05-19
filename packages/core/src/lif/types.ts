import type { EdgeTrajectory, OrientationType } from "../map/types";

export interface LifDocument {
  metaInformation?: Record<string, unknown>;
  layouts: LifLayout[];
  [key: string]: unknown;
}

export interface LifLayout {
  layoutId: string;
  layoutName?: string;
  layoutVersion?: string;
  layoutDescription?: string;
  nodes?: LifNode[];
  edges?: LifEdge[];
  stations?: unknown[];
  [key: string]: unknown;
}

export interface LifNode {
  nodeId: string;
  nodeName?: string;
  mapId?: string;
  nodePosition?: {
    x?: number;
    y?: number;
    theta?: number;
    [key: string]: unknown;
  };
  vehicleTypeNodeProperties?: unknown[];
  [key: string]: unknown;
}

export interface LifEdge {
  edgeId: string;
  edgeName?: string;
  startNodeId: string;
  endNodeId: string;
  vehicleTypeEdgeProperties?: LifVehicleTypeEdgeProperty[];
  [key: string]: unknown;
}

export interface LifVehicleTypeEdgeProperty {
  vehicleTypeId?: string;
  vehicleOrientation?: number;
  orientationType?: OrientationType;
  rotationAllowed?: boolean;
  maxSpeed?: number;
  trajectory?: EdgeTrajectory;
  [key: string]: unknown;
}
