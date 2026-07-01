import type { VdaState } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useFleetStore } from "../fleet-store";

describe("fleet store", () => {
  beforeEach(() => {
    useFleetStore.setState({
      agvs: {},
      selectedAgvSerial: null,
      trackedAgvSerial: null,
      realtimeStatus: "Connecting realtime...",
      orderStatuses: {},
    });
  });

  it("selects the first AGV reported by realtime", () => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "agv_state",
      serialNumber: "SIM-001",
      manufacturer: "DijkstraSim",
      state: stateFor("dock-a"),
    });

    expect(useFleetStore.getState().selectedAgvSerial).toBe("SIM-001");
  });

  it("keeps explicit AGV selection when more AGVs arrive", () => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "agv_state",
      serialNumber: "SIM-001",
      manufacturer: "DijkstraSim",
      state: stateFor("dock-a"),
    });
    useFleetStore.getState().selectAgv("SIM-001");

    useFleetStore.getState().handleRealtimeMessage({
      type: "agv_state",
      serialNumber: "SIM-002",
      manufacturer: "DijkstraSim",
      state: stateFor("corr-1"),
    });

    expect(useFleetStore.getState().selectedAgvSerial).toBe("SIM-001");
  });

  it("tracks route names from order status messages", () => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "order_status",
      serialNumber: "SIM-001",
      orderId: "order-1",
      status: "completed",
      routeId: "dock-run",
      routeName: "Dock Run",
      timestamp: new Date(0).toISOString(),
    });

    const state = useFleetStore.getState();
    expect(state.orderStatuses["SIM-001"]?.routeName).toBe("Dock Run");
  });

  it("tracks loop metadata from order status messages", () => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "order_status",
      serialNumber: "SIM-001",
      orderId: "order-loop-1",
      status: "sent",
      routeName: "Dock Loop",
      timestamp: new Date(0).toISOString(),
      loop: true,
      loopIteration: 3,
    });

    const state = useFleetStore.getState();
    expect(state.orderStatuses["SIM-001"]?.loop).toBe(true);
    expect(state.orderStatuses["SIM-001"]?.loopIteration).toBe(3);
  });

  it("surfaces the reason when an order is rejected", () => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "order_status",
      serialNumber: "SIM-001",
      orderId: "order-bad",
      status: "rejected",
      routeName: "Dock Loop",
      timestamp: new Date(0).toISOString(),
      reason: 'Order starts at node "corr-1" but the AGV is at "dock-a".',
    });

    const state = useFleetStore.getState();
    expect(state.orderStatuses["SIM-001"]?.status).toBe("rejected");
    expect(state.orderStatuses["SIM-001"]?.reason).toContain("corr-1");
  });
});

describe("fleet store — Tracking selection", () => {
  beforeEach(() => {
    useFleetStore.setState({
      agvs: {},
      selectedAgvSerial: null,
      trackedAgvSerial: null,
      realtimeStatus: "Connecting realtime...",
      orderStatuses: {},
    });
  });

  it("starts with no tracked AGV and does not auto-track on realtime arrival", () => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "agv_state",
      serialNumber: "SIM-001",
      manufacturer: "DijkstraSim",
      state: stateFor("dock-a"),
    });

    expect(useFleetStore.getState().trackedAgvSerial).toBeNull();
  });

  it("tracks and clears an AGV without disturbing the route assign-target", () => {
    useFleetStore.getState().selectAgv("SIM-002");

    useFleetStore.getState().trackAgv("SIM-001");
    expect(useFleetStore.getState().trackedAgvSerial).toBe("SIM-001");
    expect(useFleetStore.getState().selectedAgvSerial).toBe("SIM-002");

    useFleetStore.getState().clearTrackedAgv();
    expect(useFleetStore.getState().trackedAgvSerial).toBeNull();
    expect(useFleetStore.getState().selectedAgvSerial).toBe("SIM-002");
  });

  it("derives no live AGV when the tracked serial left the fleet (card stays closed)", () => {
    useFleetStore.getState().handleRealtimeMessage({
      type: "agv_state",
      serialNumber: "SIM-001",
      manufacturer: "DijkstraSim",
      state: stateFor("dock-a"),
    });
    useFleetStore.getState().trackAgv("SIM-001");

    useFleetStore.setState({ agvs: {} });

    const state = useFleetStore.getState();
    expect(state.trackedAgvSerial).toBe("SIM-001");
    expect(state.agvs[state.trackedAgvSerial!]).toBeUndefined();
  });
});

function stateFor(lastNodeId: string) {
  return {
    lastNodeId,
    driving: false,
    batteryState: { batteryCharge: 90 },
    agvPosition: { x: 0, y: 0, theta: 0, mapId: "demo-grid" },
  } as VdaState;
}
