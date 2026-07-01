import { buildVdaOrder, createDemoMap } from "@agv/core";
import { describe, expect, it } from "vitest";
import { createSimulatorFleet, type SimulatorFleetPublisher } from "./simulator-fleet";

function createCapturingPublisher() {
  const orderStatuses: Array<Parameters<SimulatorFleetPublisher["publishOrderStatus"]>[0]> = [];
  const publisher: SimulatorFleetPublisher = {
    publishAgv: () => {},
    publishConnection: () => {},
    publishOrderStatus: (data) => orderStatuses.push(data),
  };
  return { publisher, orderStatuses };
}

describe("simulator fleet order acceptance", () => {
  const map = createDemoMap();
  const envelope = (routeNodeIds: string[], orderId: string) => ({
    manufacturer: "Simulated",
    serialNumber: "SIM-001",
    order: buildVdaOrder(map, { mapId: map.id, agvSerialNumber: "SIM-001", routeNodeIds }, orderId),
  });

  it("refuses and flags an order whose first node is not where the AGV is", () => {
    const { publisher, orderStatuses } = createCapturingPublisher();
    const fleet = createSimulatorFleet({ publisher, log: null });
    fleet.createAgv({ serialNumber: "SIM-001", manufacturer: "Simulated", map, startNodeId: "dock-a" });

    fleet.acceptOrder(envelope(["corr-1", "dock-a"], "bad-order"));

    const rejected = orderStatuses.find((status) => status.orderId === "bad-order");
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.reason).toContain("corr-1");
    expect(rejected?.reason).toContain("dock-a");
    expect(orderStatuses.some((status) => status.status === "received")).toBe(false);

    fleet.tickMotion(1000);
    const agv = fleet.listAgvs()[0]!;
    expect(agv.driving).toBe(false);
    expect(agv.currentOrder).toBeNull();
    expect(agv.currentNodeId).toBe("dock-a");
  });

  it("accepts an order that starts at the AGV's current node", () => {
    const { publisher, orderStatuses } = createCapturingPublisher();
    const fleet = createSimulatorFleet({ publisher, log: null });
    fleet.createAgv({ serialNumber: "SIM-001", manufacturer: "Simulated", map, startNodeId: "dock-a" });

    fleet.acceptOrder(envelope(["dock-a", "corr-1"], "good-order"));

    const received = orderStatuses.find((status) => status.orderId === "good-order");
    expect(received?.status).toBe("received");
    expect(orderStatuses.some((status) => status.status === "rejected")).toBe(false);

    fleet.tickMotion(100);
    expect(fleet.listAgvs()[0]!.driving).toBe(true);
  });
});
