import { buildVdaOrder } from "@agv/core";
import type { FleetGateway, MapRepository, OrderHandlers, RealtimePublisher } from "../domain/ports";

export interface OrderMetadata {
  routeId?: string;
  routeName?: string;
}

export interface OrderTracker {
  remember: (orderId: string, metadata: OrderMetadata) => void;
  enrich: (data: Record<string, unknown>) => Record<string, unknown>;
}

export function createOrderTracker(): OrderTracker {
  const metadataByOrder = new Map<string, OrderMetadata>();

  return {
    remember: (orderId, metadata) => {
      if (metadata.routeId || metadata.routeName) metadataByOrder.set(orderId, metadata);
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
  return {
    sendOrder: async (draft) => {
      const map = maps.get(draft.mapId);
      if (!map) throw createServiceError(404, "Map not found.");

      const agv = fleet.getAgv(draft.agvSerialNumber);
      if (!agv) throw createServiceError(404, "AGV not connected.");

      try {
        const order = buildVdaOrder(map, draft);
        const metadata: OrderMetadata = {
          ...(draft.routeId ? { routeId: draft.routeId } : {}),
          ...(draft.routeName ? { routeName: draft.routeName } : {}),
        };
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
      } catch (error) {
        throw createServiceError(400, error instanceof Error ? error.message : "Invalid order.");
      }
    },
  };
}

export function createServiceError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

export function isServiceError(error: unknown): error is Error & { statusCode: number } {
  return error instanceof Error && typeof (error as { statusCode?: unknown }).statusCode === "number";
}
