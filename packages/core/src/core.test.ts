import { describe, expect, it } from "vitest";
import {
  acceptOrder,
  advanceAgv,
  buildVdaOrder,
  createDemoMap,
  createSimulatedAgv,
  exportLifDocument,
  importLifDocument,
  validateMap,
  validateRoute,
} from "./index.js";

describe("map validation", () => {
  it("accepts the demo map", () => {
    expect(validateMap(createDemoMap())).toEqual([]);
  });

  it("rejects disconnected routes", () => {
    const map = createDemoMap();
    const issues = validateRoute(map, ["dock-a", "mat-b"]);
    expect(issues[0]?.code).toBe("route.edge.missing");
  });
});

describe("LIF import/export", () => {
  it("preserves edge trajectory shape", () => {
    const map = createDemoMap();
    map.edges[0]!.trajectory = {
      degree: 2,
      knotVector: [0, 0, 0, 1, 1, 1],
      controlPoints: [
        { x: 0, y: 0 },
        { x: 2, y: 2, weight: 1 },
        { x: 5, y: 0 },
      ],
    };

    const lif = exportLifDocument(map);
    const imported = importLifDocument(lif);
    expect(imported.edges[0]?.trajectory?.degree).toBe(2);
    expect(imported.edges[0]?.trajectory?.controlPoints).toHaveLength(3);
  });
});

describe("VDA order generation", () => {
  it("builds alternating node and edge sequence ids", () => {
    const map = createDemoMap();
    const order = buildVdaOrder(map, {
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1", "corr-2"],
    }, "order-test");

    expect(order.orderId).toBe("order-test");
    expect(order.nodes.map((node) => node.sequenceId)).toEqual([0, 2, 4]);
    expect(order.edges.map((edge) => edge.sequenceId)).toEqual([1, 3]);
  });
});

describe("simulator integration", () => {
  it("moves an AGV through an order and completes it", () => {
    const map = createDemoMap();
    const order = buildVdaOrder(map, {
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
    }, "order-test");

    let agv = createSimulatedAgv({ serialNumber: "SIM-001", map, startNodeId: "dock-a", speedMetersPerSecond: 10 });
    agv = acceptOrder(agv, order);
    for (let index = 0; index < 10; index += 1) {
      agv = advanceAgv(agv, 1000);
    }

    expect(agv.currentOrder).toBeNull();
    expect(agv.currentNodeId).toBe("corr-1");
    expect(agv.driving).toBe(false);
  });
});
