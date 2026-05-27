import { EStop, OperatingMode } from "vda-5050-lib";
import {
  getQuadraticBezierPoseAtDistance,
  isSupportedQuadraticBezier,
  findNode,
  type EdgeTrajectory,
  type MapDocument,
  type VdaOrder,
  type VdaStateDraft,
  type VdaVisualizationDraft,
} from "@agv/core";
import type { SimulatedAgv } from "./types";

export function createSimulatedAgv(params: {
  serialNumber: string;
  manufacturer?: string;
  map: MapDocument;
  startNodeId?: string;
  speedMetersPerSecond?: number;
}): SimulatedAgv {
  const startNode = params.startNodeId
    ? findNode(params.map, params.startNodeId)
    : params.map.nodes[0];
  if (!startNode) throw new Error("Cannot create simulated AGV without a start node.");

  return {
    serialNumber: params.serialNumber,
    manufacturer: params.manufacturer || "Simulated",
    mapId: params.map.id,
    currentNodeId: startNode.id,
    x: startNode.x,
    y: startNode.y,
    theta: startNode.theta || 0,
    batteryCharge: 90,
    connectionStatus: "ONLINE",
    currentOrder: null,
    remainingNodes: [],
    remainingEdges: [],
    activeEdgeDistance: 0,
    speedMetersPerSecond: params.speedMetersPerSecond || 1.2,
    driving: false,
  };
}

export function acceptOrder(agv: SimulatedAgv, order: VdaOrder): SimulatedAgv {
  const remainingNodes = [...order.nodes];
  const first = remainingNodes[0];
  if (first && first.nodeId === agv.currentNodeId) {
    remainingNodes.shift();
  }
  return {
    ...agv,
    currentOrder: order,
    remainingNodes,
    remainingEdges: [...order.edges],
    activeEdgeDistance: 0,
    driving: remainingNodes.length > 0,
  };
}

export function advanceAgv(agv: SimulatedAgv, dtMs: number): SimulatedAgv {
  if (!agv.currentOrder || agv.remainingNodes.length === 0) {
    return { ...agv, driving: false };
  }

  const target = agv.remainingNodes[0];
  if (!target) return agv;
  const targetPosition = target.nodePosition;
  if (!targetPosition) return { ...agv, driving: false };

  const dx = targetPosition.x - agv.x;
  const dy = targetPosition.y - agv.y;
  const distance = Math.hypot(dx, dy);
  const activeEdge = agv.remainingEdges[0];
  const maxSpeed = activeEdge?.maxSpeed || agv.speedMetersPerSecond;
  const speed = Math.min(agv.speedMetersPerSecond, maxSpeed);
  const step = speed * (dtMs / 1000);

  if (activeEdge && isSupportedQuadraticBezier(activeEdge.trajectory as EdgeTrajectory | null | undefined)) {
    const distance = agv.activeEdgeDistance + step;
    const pose = getQuadraticBezierPoseAtDistance(activeEdge.trajectory as EdgeTrajectory, distance);
    if (distance >= pose.totalLength) {
      return arriveAtTarget(agv, target, targetPosition);
    }
    return {
      ...agv,
      x: pose.x,
      y: pose.y,
      theta: pose.theta,
      activeEdgeDistance: distance,
      batteryCharge: Math.max(0, agv.batteryCharge - 0.01),
      driving: true,
    };
  }

  if (distance <= Math.max(step, 0.001)) {
    return arriveAtTarget(agv, target, targetPosition);
  }

  const ratio = step / distance;
  return {
    ...agv,
    x: agv.x + dx * ratio,
    y: agv.y + dy * ratio,
    theta: Math.atan2(dy, dx),
    activeEdgeDistance: 0,
    batteryCharge: Math.max(0, agv.batteryCharge - 0.01),
    driving: true,
  };
}

function arriveAtTarget(
  agv: SimulatedAgv,
  target: NonNullable<SimulatedAgv["remainingNodes"][number]>,
  targetPosition: NonNullable<NonNullable<SimulatedAgv["remainingNodes"][number]>["nodePosition"]>
): SimulatedAgv {
  const remainingNodes = agv.remainingNodes.slice(1);
  const remainingEdges = agv.remainingEdges.slice(1);
  const orderComplete = remainingNodes.length === 0;
  return {
    ...agv,
    currentNodeId: target.nodeId,
    x: targetPosition.x,
    y: targetPosition.y,
    theta: targetPosition.theta ?? agv.theta,
    batteryCharge: Math.max(0, agv.batteryCharge - 0.02),
    currentOrder: orderComplete ? null : agv.currentOrder,
    remainingNodes,
    remainingEdges,
    activeEdgeDistance: 0,
    driving: !orderComplete,
  };
}

export function buildState(agv: SimulatedAgv): VdaStateDraft {
  return {
    orderId: agv.currentOrder?.orderId || "",
    orderUpdateId: agv.currentOrder?.orderUpdateId || 0,
    lastNodeId: agv.currentNodeId,
    lastNodeSequenceId: 0,
    driving: agv.driving,
    paused: false,
    operatingMode: OperatingMode.Automatic,
    nodeStates: agv.remainingNodes.map((node) => ({
      nodeId: node.nodeId,
      sequenceId: node.sequenceId,
      released: node.released,
      ...(node.nodePosition ? { nodePosition: node.nodePosition } : {}),
    })),
    edgeStates: agv.remainingEdges.map((edge) => ({
      edgeId: edge.edgeId,
      sequenceId: edge.sequenceId,
      released: edge.released,
    })),
    agvPosition: {
      x: agv.x,
      y: agv.y,
      theta: agv.theta,
      mapId: agv.mapId,
      positionInitialized: true,
    },
    velocity: {
      vx: agv.driving ? agv.speedMetersPerSecond : 0,
      vy: 0,
      omega: 0,
    },
    actionStates: [],
    batteryState: {
      batteryCharge: Math.round(agv.batteryCharge * 10) / 10,
      charging: false,
    },
    errors: [],
    safetyState: {
      eStop: EStop.None,
      fieldViolation: false,
    },
    information: [],
  };
}

export function buildVisualization(agv: SimulatedAgv): VdaVisualizationDraft {
  return {
    agvPosition: {
      x: agv.x,
      y: agv.y,
      theta: agv.theta,
      mapId: agv.mapId,
      positionInitialized: true,
    },
    velocity: {
      vx: agv.driving ? agv.speedMetersPerSecond : 0,
      vy: 0,
      omega: 0,
    },
  };
}

export type { SimulatedAgv } from "./types";
