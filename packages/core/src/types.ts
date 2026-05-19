export type OrientationType = "GLOBAL" | "TANGENTIAL";
export type ConnectionStatus = "ONLINE" | "OFFLINE" | "CONNECTIONBROKEN";
export type OperatingMode = "AUTOMATIC" | "SEMIAUTOMATIC" | "MANUAL" | "SERVICE" | "TEACHIN";
export type EStopType = "NONE" | "AUTOACK" | "MANUAL" | "REMOTE";

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

export interface OrderDraft {
  mapId: string;
  agvSerialNumber: string;
  routeNodeIds: string[];
}

export interface VdaOrder {
  orderId: string;
  orderUpdateId: number;
  nodes: VdaOrderNode[];
  edges: VdaOrderEdge[];
}

export interface VdaOrderNode {
  nodeId: string;
  sequenceId: number;
  released: boolean;
  nodePosition: {
    x: number;
    y: number;
    theta?: number;
    mapId: string;
  };
  actions: unknown[];
}

export interface VdaOrderEdge {
  edgeId: string;
  sequenceId: number;
  released: boolean;
  startNodeId: string;
  endNodeId: string;
  maxSpeed?: number;
  orientation?: number;
  orientationType?: OrientationType;
  rotationAllowed?: boolean;
  trajectory?: EdgeTrajectory;
  actions: unknown[];
}

export interface VdaState {
  orderId: string;
  orderUpdateId: number;
  lastNodeId: string;
  lastNodeSequenceId: number;
  driving: boolean;
  paused: boolean;
  operatingMode: OperatingMode;
  nodeStates: Array<{
    nodeId: string;
    sequenceId: number;
    released: boolean;
    nodePosition?: {
      x: number;
      y: number;
      theta?: number;
      mapId: string;
    };
  }>;
  edgeStates: Array<{
    edgeId: string;
    sequenceId: number;
    released: boolean;
  }>;
  agvPosition: {
    x: number;
    y: number;
    theta: number;
    mapId: string;
    positionInitialized: boolean;
  };
  velocity: {
    vx: number;
    vy: number;
    omega: number;
  };
  actionStates: unknown[];
  batteryState: {
    batteryCharge: number;
    charging: boolean;
  };
  errors: unknown[];
  safetyState: {
    eStop: EStopType;
    fieldViolation: boolean;
  };
  information: unknown[];
}

export interface VdaVisualization {
  agvPosition: VdaState["agvPosition"];
  velocity: VdaState["velocity"];
}

export interface SimulatedAgv {
  serialNumber: string;
  manufacturer: string;
  mapId: string;
  currentNodeId: string;
  x: number;
  y: number;
  theta: number;
  batteryCharge: number;
  connectionStatus: ConnectionStatus;
  currentOrder: VdaOrder | null;
  remainingNodes: VdaOrderNode[];
  remainingEdges: VdaOrderEdge[];
  speedMetersPerSecond: number;
  driving: boolean;
}

export interface ValidationIssue {
  code: string;
  message: string;
}
