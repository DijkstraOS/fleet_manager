import { createDemoMap, type MapDocument, type VdaOrder } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  FleetGateway,
  KnownAgv,
  MapRepository,
  RealtimeMessage,
} from "../../apps/server/src/domain/ports";
import { createFleetHandlers } from "../../apps/server/src/services/fleet-service";
import { createMapHandlers } from "../../apps/server/src/services/map-service";
import { createOrderHandlers } from "../../apps/server/src/services/order-service";

let map: MapDocument;
let realtimeMessages: RealtimeMessage[];
let sentOrder: VdaOrder | null;

beforeEach(() => {
  map = createDemoMap();
  realtimeMessages = [];
  sentOrder = null;
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

  it("builds and publishes an order through the fleet gateway", () => {
    const handlers = createOrderHandlers(createRepository(), fleet, realtime);

    const result = handlers.sendOrder({
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
    });

    expect(result.status).toBe("sent");
    expect(sentOrder?.nodes.map((node) => node.nodeId)).toEqual(["dock-a", "corr-1"]);
    expect(realtimeMessages[0]?.type).toBe("order_status");
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
  publishOrder: (_agv, order) => {
    sentOrder = order;
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
