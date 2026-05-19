import type { ConnectionStatus, VdaOrder, VdaOrderEdge, VdaOrderNode } from "@agv/core";

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
