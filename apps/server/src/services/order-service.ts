import { buildVdaOrder } from "@agv/core";
import type { FleetGateway, MapRepository, OrderHandlers, RealtimePublisher } from "../domain/ports";

export function createOrderHandlers(
  maps: MapRepository,
  fleet: FleetGateway,
  realtime: RealtimePublisher
): OrderHandlers {
  return {
    sendOrder: (draft) => {
      const map = maps.get(draft.mapId);
      if (!map) throw createServiceError(404, "Map not found.");

      const agv = fleet.getAgv(draft.agvSerialNumber);
      if (!agv) throw createServiceError(404, "AGV not connected.");

      try {
        const order = buildVdaOrder(map, draft);
        fleet.publishOrder(agv, order);
        const payload = {
          status: "sent" as const,
          orderId: order.orderId,
          serialNumber: agv.serialNumber,
          timestamp: new Date().toISOString(),
        };
        realtime.broadcast({ type: "order_status", ...payload });
        return { ...payload, order };
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
