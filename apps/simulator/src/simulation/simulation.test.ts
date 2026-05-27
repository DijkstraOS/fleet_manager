import { buildVdaOrder, createDemoMap, createQuadraticBezierTrajectory } from "@agv/core";
import { describe, expect, it } from "vitest";
import { acceptOrder, advanceAgv, createSimulatedAgv } from "./index";

describe("simulator motion", () => {
  it("moves an AGV through an order and completes it", () => {
    const map = createDemoMap();
    const order = buildVdaOrder(map, {
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
    }, "order-test");

    let agv = createSimulatedAgv({
      serialNumber: "SIM-001",
      map,
      startNodeId: "dock-a",
      speedMetersPerSecond: 10,
    });
    agv = acceptOrder(agv, order);
    for (let index = 0; index < 10; index += 1) {
      agv = advanceAgv(agv, 1000);
    }

    expect(agv.currentOrder).toBeNull();
    expect(agv.currentNodeId).toBe("corr-1");
    expect(agv.driving).toBe(false);
  });

  it("follows supported quadratic edge trajectories", () => {
    const map = createDemoMap();
    const edge = map.edges.find((item) => item.from === "dock-a" && item.to === "corr-1")!;
    edge.trajectory = createQuadraticBezierTrajectory(
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 2.5, y: 4 }
    );
    const order = buildVdaOrder(map, {
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
    }, "order-test");

    let agv = createSimulatedAgv({
      serialNumber: "SIM-001",
      map,
      startNodeId: "dock-a",
      speedMetersPerSecond: 1,
    });
    agv = acceptOrder(agv, order);

    let maxY = 0;
    for (let index = 0; index < 12; index += 1) {
      agv = advanceAgv(agv, 1000);
      maxY = Math.max(maxY, agv.y);
    }

    expect(maxY).toBeGreaterThan(1);
    expect(agv.currentOrder).toBeNull();
    expect(agv.currentNodeId).toBe("corr-1");
  });

  it("falls back to straight motion for unsupported trajectories", () => {
    const map = createDemoMap();
    const edge = map.edges.find((item) => item.from === "dock-a" && item.to === "corr-1")!;
    edge.trajectory = {
      degree: 3,
      knotVector: [0, 0, 0, 0, 1, 1, 1, 1],
      controlPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 0 },
      ],
    };
    const order = buildVdaOrder(map, {
      mapId: map.id,
      agvSerialNumber: "SIM-001",
      routeNodeIds: ["dock-a", "corr-1"],
    }, "order-test");

    let agv = createSimulatedAgv({
      serialNumber: "SIM-001",
      map,
      startNodeId: "dock-a",
      speedMetersPerSecond: 10,
    });
    agv = acceptOrder(agv, order);
    agv = advanceAgv(agv, 4000);

    expect(agv.currentOrder).toBeNull();
    expect(agv.currentNodeId).toBe("corr-1");
    expect(agv.y).toBe(0);
  });
});
