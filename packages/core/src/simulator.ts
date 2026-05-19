import type { MapDocument, SimulatedAgv, VdaOrder, VdaState, VdaVisualization } from "./types.js";
import { findNode } from "./map.js";

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
    driving: remainingNodes.length > 0,
  };
}

export function advanceAgv(agv: SimulatedAgv, dtMs: number): SimulatedAgv {
  if (!agv.currentOrder || agv.remainingNodes.length === 0) {
    return { ...agv, driving: false };
  }

  const target = agv.remainingNodes[0];
  if (!target) return agv;

  const dx = target.nodePosition.x - agv.x;
  const dy = target.nodePosition.y - agv.y;
  const distance = Math.hypot(dx, dy);
  const activeEdge = agv.remainingEdges[0];
  const maxSpeed = activeEdge?.maxSpeed || agv.speedMetersPerSecond;
  const speed = Math.min(agv.speedMetersPerSecond, maxSpeed);
  const step = speed * (dtMs / 1000);

  if (distance <= Math.max(step, 0.001)) {
    const remainingNodes = agv.remainingNodes.slice(1);
    const remainingEdges = agv.remainingEdges.slice(1);
    const orderComplete = remainingNodes.length === 0;
    return {
      ...agv,
      currentNodeId: target.nodeId,
      x: target.nodePosition.x,
      y: target.nodePosition.y,
      theta: target.nodePosition.theta ?? agv.theta,
      batteryCharge: Math.max(0, agv.batteryCharge - 0.02),
      currentOrder: orderComplete ? null : agv.currentOrder,
      remainingNodes,
      remainingEdges,
      driving: !orderComplete,
    };
  }

  const ratio = step / distance;
  return {
    ...agv,
    x: agv.x + dx * ratio,
    y: agv.y + dy * ratio,
    theta: Math.atan2(dy, dx),
    batteryCharge: Math.max(0, agv.batteryCharge - 0.01),
    driving: true,
  };
}

export function buildState(agv: SimulatedAgv): VdaState {
  return {
    orderId: agv.currentOrder?.orderId || "",
    orderUpdateId: agv.currentOrder?.orderUpdateId || 0,
    lastNodeId: agv.currentNodeId,
    lastNodeSequenceId: 0,
    driving: agv.driving,
    paused: false,
    operatingMode: "AUTOMATIC",
    nodeStates: agv.remainingNodes.map((node) => ({
      nodeId: node.nodeId,
      sequenceId: node.sequenceId,
      released: node.released,
      nodePosition: node.nodePosition,
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
      eStop: "NONE",
      fieldViolation: false,
    },
    information: [],
  };
}

export function buildVisualization(agv: SimulatedAgv): VdaVisualization {
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
