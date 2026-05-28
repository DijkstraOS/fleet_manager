import { createDemoMap, type MapDocument, type RouteDocument, type VdaOrder } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  FleetGateway,
  KnownAgv,
  MapRepository,
  RealtimeMessage,
  RouteRepository,
} from "../../apps/server/src/domain/ports";
import { createFleetHandlers } from "../../apps/server/src/services/fleet-service";
import { createMapHandlers } from "../../apps/server/src/services/map-service";
import { createOrderHandlers, createOrderTracker } from "../../apps/server/src/services/order-service";
import { createRouteHandlers } from "../../apps/server/src/services/route-service";

let map: MapDocument;
let routes: RouteDocument[];
let realtimeMessages: RealtimeMessage[];
let sentOrder: VdaOrder | null;
let sentOrders: VdaOrder[];

beforeEach(() => {
  map = createDemoMap();
  routes = [];
  realtimeMessages = [];
  sentOrder = null;
  sentOrders = [];
});

describe("server services", () => {
  it("saves maps through the repository and emits map updates", async () => {
    const handlers = createMapHandlers(createRepository(), realtime);

    const saved = await handlers.saveMap({ ...map, name: "Updated Demo" });

    expect(saved.name).toBe("Updated Demo");
    expect(realtimeMessages[0]?.type).toBe("map_updated");
  });

  it("lists fleet AGVs from the fleet gateway", () => {
    const handlers = createFleetHandlers(fleet);

    expect(handlers.listAgvs()).toEqual([knownAgv]);
  });

  it("builds and publishes an order through the fleet gateway", async () => {
    const handlers = createOrderHandlers(createRepository(), fleet, realtime);

    const result = await handlers.sendOrder({
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
    });

    expect(result.status).toBe("sent");
    expect(sentOrder?.nodes.map((node) => node.nodeId)).toEqual(["dock-a", "corr-1"]);
    expect(realtimeMessages[0]?.type).toBe("order_status");
  });

  it("saves and deletes map-scoped routes", async () => {
    const handlers = createRouteHandlers(createRouteRepository(), createRepository(), realtime);

    const saved = await handlers.saveRoute({
      id: "dock-run",
      mapId: map.id,
      name: "Dock Run",
      nodeIds: ["dock-a", "corr-1"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    expect(saved.name).toBe("Dock Run");
    expect(handlers.listRoutes(map.id).map((route) => route.id)).toEqual(["dock-run"]);
    expect(realtimeMessages[0]?.type).toBe("route_updated");

    await handlers.deleteRoute("dock-run");

    expect(handlers.listRoutes(map.id)).toEqual([]);
    expect(realtimeMessages[1]?.type).toBe("route_deleted");
  });

  it("enriches order status with saved route metadata", async () => {
    const tracker = createOrderTracker();
    const handlers = createOrderHandlers(createRepository(), fleet, realtime, tracker);

    const result = await handlers.sendOrder({
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
      routeId: "dock-run",
      routeName: "Dock Run",
    });

    expect(result.routeName).toBe("Dock Run");
    expect(tracker.enrich({ orderId: result.orderId, status: "completed" }).routeName).toBe("Dock Run");
  });

  it("reissues a closed looping route after order completion", async () => {
    const handlers = createOrderHandlers(createRepository(), fleet, realtime);

    const result = await handlers.sendOrder({
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1", "dock-a"],
      routeId: "dock-loop",
      routeName: "Dock Loop",
      loop: true,
    });

    expect(result.loop).toBe(true);
    expect(result.loopIteration).toBe(1);
    expect(sentOrders).toHaveLength(1);

    handlers.handleOrderStatus({
      orderId: result.orderId,
      serialNumber: "SIM-001",
      status: "completed",
    });
    await flushPromises();

    expect(sentOrders).toHaveLength(2);
    expect(sentOrders[1]?.orderId).not.toBe(result.orderId);
    expect(realtimeMessages.at(-1)).toMatchObject({
      type: "order_status",
      status: "sent",
      routeName: "Dock Loop",
      loop: true,
      loopIteration: 2,
    });
  });

  it("rejects open routes in loop mode", async () => {
    const handlers = createOrderHandlers(createRepository(), fleet, realtime);

    await expect(handlers.sendOrder({
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
      loop: true,
    })).rejects.toMatchObject({
      statusCode: 400,
      message: "Looping route must end at its starting node.",
    });
    expect(sentOrders).toHaveLength(0);
  });

  it("stops an active loop before the next completion resend", async () => {
    const handlers = createOrderHandlers(createRepository(), fleet, realtime);

    const result = await handlers.sendOrder({
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1", "dock-a"],
      loop: true,
    });

    expect(handlers.stopLoop("SIM-001")).toBe(true);
    handlers.handleOrderStatus({
      orderId: result.orderId,
      serialNumber: "SIM-001",
      status: "completed",
    });
    await flushPromises();

    expect(sentOrders).toHaveLength(1);
    expect(realtimeMessages.at(-1)).toMatchObject({
      type: "order_status",
      status: "loop stopped",
      loop: true,
    });
  });
});

const realtime = {
  broadcast: (message: RealtimeMessage) => {
    realtimeMessages.push(message);
  },
  close: async () => {},
};

const fleet: FleetGateway = {
  listAgvs: () => [knownAgv],
  getAgv: (serialNumber) => serialNumber === knownAgv.serialNumber ? knownAgv : undefined,
  publishOrder: async (_agv, order) => {
    sentOrder = order;
    sentOrders.push(order);
    return undefined;
  },
  start: async () => {},
  close: async () => {},
};

const knownAgv: KnownAgv = {
  serialNumber: "SIM-001",
  manufacturer: "DijkstraSim",
  mapId: "demo-grid",
  connectionState: "ONLINE",
  state: null,
  visualization: null,
  lastSeenAt: new Date(0).toISOString(),
};

function createRepository(): MapRepository {
  return {
    load: async () => {},
    list: () => [{
      id: map.id,
      name: map.name,
      version: map.version,
      updatedAt: map.updatedAt,
      nodes: map.nodes.length,
      edges: map.edges.length,
    }],
    get: (id) => id === map.id ? map : undefined,
    upsert: async (next) => {
      map = next;
      return next;
    },
  };
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createRouteRepository(): RouteRepository {
  return {
    load: async () => {},
    list: (mapId) => routes.filter((route) => !mapId || route.mapId === mapId),
    get: (id) => routes.find((route) => route.id === id),
    upsert: async (route) => {
      const now = new Date().toISOString();
      const existing = routes.find((item) => item.id === route.id);
      const next = {
        ...route,
        createdAt: existing?.createdAt || route.createdAt || now,
        updatedAt: now,
      };
      routes = [...routes.filter((item) => item.id !== route.id), next];
      return next;
    },
    delete: async (id) => {
      const before = routes.length;
      routes = routes.filter((route) => route.id !== id);
      return routes.length !== before;
    },
  };
}
