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
});

function stateFor(lastNodeId: string) {
  return {
    lastNodeId,
    driving: false,
    batteryState: { batteryCharge: 90 },
    agvPosition: { x: 0, y: 0, theta: 0, mapId: "demo-grid" },
  } as VdaState;
}
