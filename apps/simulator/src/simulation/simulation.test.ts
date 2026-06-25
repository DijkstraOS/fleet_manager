import {
  buildVdaOrder,
  createDemoMap,
  createQuadraticBezierTrajectory,
  type MapDocument,
  type VdaOrder,
} from "@agv/core";
import { describe, expect, it } from "vitest";
import { acceptOrder, advanceAgv, createSimulatedAgv, type SimulatedAgv } from "./index";

// A closed, fully-curved loop A -> B -> C -> A used to exercise looping routes.
function curvedLoopMap(): MapDocument {
  const now = new Date().toISOString();
  const curvedEdge = (id: string, from: string, to: string, start: [number, number], handle: [number, number], end: [number, number]) => ({
    id,
    label: id,
    from,
    to,
    maxSpeed: 1.5,
    orientationType: "TANGENTIAL" as const,
    rotationAllowed: true,
    trajectory: createQuadraticBezierTrajectory(
      { x: start[0], y: start[1] },
      { x: end[0], y: end[1] },
      { x: handle[0], y: handle[1] }
    ),
  });
  return {
    id: "loop",
    name: "loop",
    version: "1",
    createdAt: now,
    updatedAt: now,
    nodes: [
      { id: "A", label: "A", x: 0, y: 0 },
      { id: "B", label: "B", x: 10, y: 0 },
      { id: "C", label: "C", x: 5, y: 10 },
    ],
    edges: [
      curvedEdge("A-B", "A", "B", [0, 0], [5, -4], [10, 0]),
      curvedEdge("B-C", "B", "C", [10, 0], [10, 6], [5, 10]),
      curvedEdge("C-A", "C", "A", [5, 10], [0, 6], [0, 0]),
    ],
  };
}

// Drive an AGV through an order to completion, recording the largest single-tick
// jump. A correctly-followed path only ever moves ~step per tick; a teleport onto
// the wrong edge shows up as a jump on the order of the map size.
function driveToCompletion(start: SimulatedAgv, order: VdaOrder): { agv: SimulatedAgv; maxJump: number } {
  let agv = acceptOrder(start, order);
  let maxJump = 0;
  for (let tick = 0; agv.currentOrder && tick < 5000; tick += 1) {
    const previous = { x: agv.x, y: agv.y };
    agv = advanceAgv(agv, 100);
    maxJump = Math.max(maxJump, Math.hypot(agv.x - previous.x, agv.y - previous.y));
  }
  return { agv, maxJump };
}

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

  it("follows a curved loop across repeated iterations without glitching", () => {
    const map = curvedLoopMap();
    const draft = { mapId: map.id, agvSerialNumber: "SIM-001", routeNodeIds: ["A", "B", "C", "A"] };

    let agv = createSimulatedAgv({ serialNumber: "SIM-001", map, startNodeId: "A", speedMetersPerSecond: 2 });

    for (let iteration = 1; iteration <= 3; iteration += 1) {
      // The server re-issues the same route as a fresh order each loop iteration.
      const result = driveToCompletion(agv, buildVdaOrder(map, draft, `order-${iteration}`));
      agv = result.agv;
      expect(agv.currentNodeId).toBe("A"); // closes the loop every time
      expect(result.maxJump).toBeLessThan(1); // no teleport between ticks
    }
  });

  it("holds position when the order disagrees with where the AGV is", () => {
    // The order's first node is "A", but the AGV is sitting at "B" (the fleet rejects
    // such an order at accept time; this exercises advanceAgv's last-resort guard if
    // one ever slips through). It must NOT follow A->B's curve (a teleport) nor
    // straight-line to the target (which could cut through obstacles the mapped edges
    // route around). The only safe action is to stand still.
    const map = curvedLoopMap();
    const draft = { mapId: map.id, agvSerialNumber: "SIM-001", routeNodeIds: ["A", "B", "C", "A"] };

    let agv = createSimulatedAgv({ serialNumber: "SIM-001", map, startNodeId: "B", speedMetersPerSecond: 2 });
    const { x: startX, y: startY } = agv;
    agv = acceptOrder(agv, buildVdaOrder(map, draft, "order-1"));

    for (let tick = 0; tick < 50; tick += 1) {
      agv = advanceAgv(agv, 100);
    }

    expect(agv.x).toBe(startX); // never moved
    expect(agv.y).toBe(startY);
    expect(agv.driving).toBe(false); // halted, not driving
    expect(agv.currentNodeId).toBe("B");
    expect(agv.currentOrder).not.toBeNull(); // did not falsely complete
  });
});
