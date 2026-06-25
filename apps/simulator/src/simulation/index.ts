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

/**
 * Returns a human-readable reason the AGV must refuse this order, or null if the
 * order is safe to accept. Per VDA5050 the order's first node is the node the
 * vehicle is currently standing on; an order whose first node is somewhere else
 * cannot be executed from where the AGV is, and a real vehicle would reject it
 * rather than guess a path to the start. Accepting it is what previously let the
 * simulated AGV teleport onto an uncommanded edge.
 */
export function orderRejectionReason(agv: SimulatedAgv, order: VdaOrder): string | null {
  const first = order.nodes[0];
  if (!first) return "Order contains no nodes.";
  if (first.nodeId !== agv.currentNodeId) {
    return `Order starts at node "${first.nodeId}" but the AGV is at "${agv.currentNodeId}".`;
  }
  return null;
}

export function acceptOrder(agv: SimulatedAgv, order: VdaOrder): SimulatedAgv {
  // A VDA5050 order is [n0, e0, n1, e1, ... e(k-1), nk] where edge e_i connects
  // n_i -> n_(i+1). n0 is the AGV's current node, so it is never a travel target.
  // The remaining travel targets are [n1 ... nk] and they line up one-to-one with
  // the edges [e0 ... e(k-1)]: remainingEdges[i] is the edge that leads to
  // remainingNodes[i]. Always dropping the leading node (rather than only when it
  // matches the current node) keeps these two lists the same length and in lockstep,
  // so advanceAgv can never pair a target with the wrong edge.
  const remainingNodes = order.nodes.slice(1);
  const remainingEdges = [...order.edges];
  return {
    ...agv,
    currentOrder: order,
    remainingNodes,
    remainingEdges,
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

  const activeEdge = agv.remainingEdges[0];

  // Safety stop: reaching the target means traversing activeEdge, which is only
  // valid when the AGV is standing at that edge's start node. If the order and the
  // AGV's position disagree, HOLD POSITION — do not improvise a path. Following the
  // curve would teleport the vehicle onto an uncommanded trajectory; and a straight
  // line to the target is no safer, since it can cut across shelving or walls that
  // the mapped edge was drawn to route around. Standing still is the only safe move.
  // (Orders accepted by the fleet always start at the AGV's node, so this is a
  // last-resort guard rather than a path the simulator takes in normal operation.)
  if (!activeEdge || activeEdge.startNodeId !== agv.currentNodeId) {
    return { ...agv, driving: false };
  }

  const maxSpeed = activeEdge.maxSpeed || agv.speedMetersPerSecond;
  const speed = Math.min(agv.speedMetersPerSecond, maxSpeed);
  const step = speed * (dtMs / 1000);

  if (isSupportedQuadraticBezier(activeEdge.trajectory as EdgeTrajectory | null | undefined)) {
    const traveled = agv.activeEdgeDistance + step;
    const pose = getQuadraticBezierPoseAtDistance(activeEdge.trajectory as EdgeTrajectory, traveled);
    if (traveled >= pose.totalLength) {
      return arriveAtTarget(agv, target, targetPosition);
    }
    return {
      ...agv,
      x: pose.x,
      y: pose.y,
      theta: pose.theta,
      activeEdgeDistance: traveled,
      batteryCharge: Math.max(0, agv.batteryCharge - 0.01),
      driving: true,
    };
  }

  // The edge carries no trajectory, so it is a straight segment by design. The AGV
  // is standing at its start node (guaranteed above), so a straight line to the
  // target node follows the commanded edge rather than a fabricated shortcut.
  const dx = targetPosition.x - agv.x;
  const dy = targetPosition.y - agv.y;
  const distance = Math.hypot(dx, dy);
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
