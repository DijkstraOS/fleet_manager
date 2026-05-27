import type { MapDocument } from "../map/index";
import { findEdge, findNode, syncTrajectoryEndpoints, validateRoute } from "../map/index";
import type { OrderDraft, VdaOrder, VdaOrderEdge, VdaOrderNode } from "./types";

export function buildVdaOrder(map: MapDocument, draft: OrderDraft, orderId = makeOrderId()): VdaOrder {
  const issues = validateRoute(map, draft.routeNodeIds);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }

  const nodes: VdaOrderNode[] = draft.routeNodeIds.map((nodeId, index) => {
    const node = findNode(map, nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found.`);
    return {
      nodeId: node.id,
      sequenceId: index * 2,
      released: true,
      nodePosition: {
        x: node.x,
        y: node.y,
        ...(node.theta !== undefined ? { theta: node.theta } : {}),
        mapId: draft.mapId,
      },
      actions: [],
    };
  });

  const edges: VdaOrderEdge[] = [];
  for (let index = 0; index < draft.routeNodeIds.length - 1; index += 1) {
    const from = draft.routeNodeIds[index];
    const to = draft.routeNodeIds[index + 1];
    if (!from || !to) throw new Error("Route contains an invalid gap.");
    const edge = findEdge(map, from, to);
    if (!edge) throw new Error(`No directed edge from ${from} to ${to}.`);
    const syncedEdge = syncTrajectoryEndpoints(edge, findNode(map, from), findNode(map, to));
    edges.push({
      edgeId: syncedEdge.id,
      sequenceId: index * 2 + 1,
      released: true,
      startNodeId: from,
      endNodeId: to,
      ...(syncedEdge.maxSpeed !== undefined ? { maxSpeed: syncedEdge.maxSpeed } : {}),
      ...(syncedEdge.orientation !== undefined ? { orientation: syncedEdge.orientation } : {}),
      orientationType: toVdaOrientationType(syncedEdge.orientationType),
      rotationAllowed: syncedEdge.rotationAllowed,
      ...(syncedEdge.trajectory ? { trajectory: syncedEdge.trajectory } : {}),
      actions: [],
    });
  }

  return {
    orderId,
    orderUpdateId: 0,
    nodes,
    edges,
  };
}

export function makeOrderId(date = new Date()): string {
  return `order-${date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function toVdaOrientationType(value: "GLOBAL" | "TANGENTIAL"): NonNullable<VdaOrderEdge["orientationType"]> {
  return value as NonNullable<VdaOrderEdge["orientationType"]>;
}

export type {
  ConnectionStatus,
  EStopType,
  OperatingMode,
  OrderDraft,
  VdaOrder,
  VdaOrderEdge,
  VdaOrderNode,
  VdaPublishedOrder,
  VdaConnection,
  VdaConnectionDraft,
  VdaState,
  VdaStateDraft,
  VdaVisualization,
  VdaVisualizationDraft,
} from "./types";
export { VDA_5050_VERSION } from "./types";
