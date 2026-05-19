import type { EdgeTrajectory } from "../map/types";

export type ConnectionStatus = "ONLINE" | "OFFLINE" | "CONNECTIONBROKEN";
export type OperatingMode = "AUTOMATIC" | "SEMIAUTOMATIC" | "MANUAL" | "SERVICE" | "TEACHIN";
export type EStopType = "NONE" | "AUTOACK" | "MANUAL" | "REMOTE";

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
  orientationType?: "GLOBAL" | "TANGENTIAL";
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
