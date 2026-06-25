import { buildVdaOrder } from "@agv/core";
import type { OrderDraft } from "@agv/core";
import type { FleetGateway, KnownAgv, MapRepository, OrderHandlers, OrderResult, RealtimePublisher } from "../domain/ports";

export interface OrderMetadata {
  routeId?: string;
  routeName?: string;
  loop?: boolean;
  loopIteration?: number;
}

export interface OrderTracker {
  remember: (orderId: string, metadata: OrderMetadata) => void;
  enrich: (data: Record<string, unknown>) => Record<string, unknown>;
}

export function createOrderTracker(): OrderTracker {
  const metadataByOrder = new Map<string, OrderMetadata>();

  return {
    remember: (orderId, metadata) => {
      if (
        metadata.routeId
        || metadata.routeName
        || metadata.loop
        || metadata.loopIteration !== undefined
      ) {
        metadataByOrder.set(orderId, metadata);
      }
    },
    enrich: (data) => {
      const orderId = typeof data.orderId === "string" ? data.orderId : "";
      const metadata = metadataByOrder.get(orderId);
      return metadata ? { ...data, ...metadata } : data;
    },
  };
}

export function createOrderHandlers(
  maps: MapRepository,
  fleet: FleetGateway,
  realtime: RealtimePublisher,
  orderTracker?: OrderTracker
): OrderHandlers {
  const activeLoops = new Map<string, ActiveLoop>();
  let nextLoopId = 1;
  let nextLoopOrderSequence = 1;

  async function publishDraft(
    draft: OrderDraft,
    options: {
      orderId?: string;
      loop?: boolean;
      loopIteration?: number;
    } = {}
  ): Promise<OrderResult> {
    const map = maps.get(draft.mapId);
    if (!map) throw createServiceError(404, "Map not found.");

    const agv = fleet.getAgv(draft.agvSerialNumber);
    if (!agv) throw createServiceError(404, "AGV not connected.");

    assertOrderStartsAtAgv(agv, draft);

    const order = buildVdaOrder(map, draft, options.orderId);
    const metadata = metadataForDraft(draft, options);
    orderTracker?.remember(order.orderId, metadata);
    const publishedOrder = await fleet.publishOrder(agv, order);
    const payload = {
      status: "sent" as const,
      orderId: order.orderId,
      serialNumber: agv.serialNumber,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    realtime.broadcast({ type: "order_status", ...payload });
    return { ...payload, order: publishedOrder || order };
  }

  async function continueLoop(serialNumber: string, loopId: number) {
    const active = activeLoops.get(serialNumber);
    if (!active || active.id !== loopId) return;

    const nextIteration = active.iteration + 1;
    try {
      const result = await publishDraft(active.draft, {
        orderId: makeLoopOrderId(new Date(), nextLoopOrderSequence++),
        loop: true,
        loopIteration: nextIteration,
      });
      const current = activeLoops.get(serialNumber);
      if (!current || current.id !== loopId) return;
      activeLoops.set(serialNumber, {
        ...current,
        currentOrderId: result.orderId,
        iteration: nextIteration,
        resending: false,
      });
    } catch (error) {
      const current = activeLoops.get(serialNumber);
      if (!current || current.id !== loopId) return;
      activeLoops.delete(serialNumber);
      realtime.broadcast({
        type: "order_status",
        status: "failed",
        orderId: current.currentOrderId,
        serialNumber,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Loop failed.",
        ...metadataForDraft(current.draft, { loop: true, loopIteration: nextIteration }),
      });
    }
  }

  return {
    sendOrder: async (draft) => {
      try {
        if (draft.loop) assertLoopableRoute(draft);
        else activeLoops.delete(draft.agvSerialNumber);

        const result = await publishDraft(draft, {
          ...(draft.loop ? {
            orderId: makeLoopOrderId(new Date(), nextLoopOrderSequence++),
            loop: true,
            loopIteration: 1,
          } : {}),
        });

        if (draft.loop) {
          activeLoops.set(draft.agvSerialNumber, {
            id: nextLoopId++,
            draft: cloneLoopDraft(draft),
            currentOrderId: result.orderId,
            iteration: 1,
            resending: false,
          });
        }

        return result;
      } catch (error) {
        if (isServiceError(error)) throw error;
        throw createServiceError(400, error instanceof Error ? error.message : "Invalid order.");
      }
    },

    stopLoop: (serialNumber) => {
      const active = activeLoops.get(serialNumber);
      if (!active) return false;
      activeLoops.delete(serialNumber);
      realtime.broadcast({
        type: "order_status",
        status: "loop stopped",
        orderId: active.currentOrderId,
        serialNumber,
        timestamp: new Date().toISOString(),
        ...metadataForDraft(active.draft, { loop: true, loopIteration: active.iteration }),
      });
      return true;
    },

    handleOrderStatus: (data) => {
      if (data.status !== "completed") return;
      const serialNumber = typeof data.serialNumber === "string" ? data.serialNumber : "";
      const orderId = typeof data.orderId === "string" ? data.orderId : "";
      const active = activeLoops.get(serialNumber);
      if (!active || active.currentOrderId !== orderId || active.resending) return;

      activeLoops.set(serialNumber, { ...active, resending: true });
      void continueLoop(serialNumber, active.id);
    },
  };
}

interface ActiveLoop {
  id: number;
  draft: OrderDraft;
  currentOrderId: string;
  iteration: number;
  resending: boolean;
}

function metadataForDraft(
  draft: OrderDraft,
  options: {
    loop?: boolean;
    loopIteration?: number;
  } = {}
): OrderMetadata {
  return {
    ...(draft.routeId ? { routeId: draft.routeId } : {}),
    ...(draft.routeName ? { routeName: draft.routeName } : {}),
    ...(options.loop ? { loop: true } : {}),
    ...(options.loopIteration !== undefined ? { loopIteration: options.loopIteration } : {}),
  };
}

function cloneLoopDraft(draft: OrderDraft): OrderDraft {
  return {
    mapId: draft.mapId,
    agvSerialNumber: draft.agvSerialNumber,
    routeNodeIds: [...draft.routeNodeIds],
    ...(draft.routeId ? { routeId: draft.routeId } : {}),
    ...(draft.routeName ? { routeName: draft.routeName } : {}),
    loop: true,
  };
}

/**
 * VDA5050 requires an order's first node to be the node the vehicle is currently
 * on (within its deviation range). An order that starts elsewhere can send a
 * compliant vehicle down an unexpected path -- it is the order shape that let the
 * simulated AGV teleport onto the wrong edge and shortcut its route -- so we
 * refuse to emit it toward a live vehicle. The AGV's reported `state.lastNodeId`
 * is its last reached / current node; it is `""` until the AGV reports one and
 * `state` is null until any state arrives. When we know where the AGV is, the
 * route must start there; when we don't, we publish but warn, since we cannot
 * confirm the start.
 */
function assertOrderStartsAtAgv(agv: KnownAgv, draft: OrderDraft) {
  const start = draft.routeNodeIds[0];
  if (!start) return;

  const currentNode = agv.state?.lastNodeId;
  if (!currentNode) {
    console.warn(
      `[order] ${agv.serialNumber} has not reported a position; publishing order starting at "${start}" without confirming the AGV is there.`
    );
    return;
  }

  if (start !== currentNode) {
    throw createServiceError(
      409,
      `Order starts at node "${start}" but ${agv.serialNumber} is at "${currentNode}".`
    );
  }
}

function assertLoopableRoute(draft: OrderDraft) {
  const first = draft.routeNodeIds[0];
  const last = draft.routeNodeIds[draft.routeNodeIds.length - 1];
  if (!first || first !== last) {
    throw createServiceError(400, "Looping route must end at its starting node.");
  }
}

function makeLoopOrderId(date: Date, sequence: number): string {
  const timestamp = date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
  return `order-loop-${timestamp}-${sequence}`;
}

export function createServiceError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

export function isServiceError(error: unknown): error is Error & { statusCode: number } {
  return error instanceof Error && typeof (error as { statusCode?: unknown }).statusCode === "number";
}
