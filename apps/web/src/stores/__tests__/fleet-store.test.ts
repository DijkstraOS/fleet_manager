import type { VdaState } from "@agv/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useFleetStore } from "../fleet-store";

describe("fleet store", () => {
  beforeEach(() => {
    useFleetStore.setState({
      agvs: {},
      selectedAgvSerial: null,
      realtimeStatus: "Connecting realtime...",
      orderStatus: "",
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
    expect(state.orderStatus).toBe("SIM-001 Dock Run: completed");
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
