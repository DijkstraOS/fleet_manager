import { describe, expect, it } from "vitest";
import {
  buildVdaOrder,
  createDemoMap,
  exportLifDocument,
  importLifDocument,
  nextRouteId,
  validateMap,
  validateRoute,
  validateRouteDocument,
} from "./index";

describe("map validation", () => {
  it("accepts the demo map", () => {
    expect(validateMap(createDemoMap())).toEqual([]);
  });

  it("rejects disconnected routes", () => {
    const map = createDemoMap();
    const issues = validateRoute(map, ["dock-a", "mat-b"]);
    expect(issues[0]?.code).toBe("route.edge.missing");
  });

  it("validates saved route documents against directed map edges", () => {
    const map = createDemoMap();

    expect(validateRouteDocument(map, {
      id: "dock-run",
      mapId: map.id,
      name: "Dock Run",
      nodeIds: ["dock-a", "corr-1"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })).toEqual([]);

    expect(validateRouteDocument(map, {
      id: "bad-run",
      mapId: map.id,
      name: "Bad Run",
      nodeIds: ["dock-a", "mat-b"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })[0]?.code).toBe("route.edge.missing");
  });

  it("generates stable route ids from names", () => {
    expect(nextRouteId([{
      id: "dock-run",
      mapId: "demo-grid",
      name: "Dock Run",
      nodeIds: ["dock-a", "corr-1"],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }], "Dock Run")).toBe("dock-run-2");
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
