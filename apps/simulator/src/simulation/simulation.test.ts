import { buildVdaOrder, createDemoMap } from "@agv/core";
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
});
