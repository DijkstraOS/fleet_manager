import { createDemoMap } from "@agv/core";
import { describe, expect, it } from "vitest";
import { buildStartupAgvCommands } from "./startup-agvs";

describe("buildStartupAgvCommands", () => {
  it("creates configured dummy AGV commands from startup options", () => {
    const map = createDemoMap();

    const commands = buildStartupAgvCommands({
      map,
      agvCount: 3,
      serialPrefix: "SIM",
      manufacturer: "DijkstraSim",
      startNodes: ["dock-a", "corr-1"],
      speedMetersPerSecond: 2.5,
    });

    expect(commands.map((command) => command.serialNumber)).toEqual(["SIM-001", "SIM-002", "SIM-003"]);
    expect(commands.map((command) => command.startNodeId)).toEqual(["dock-a", "corr-1", "dock-a"]);
    expect(commands.every((command) => command.map === map)).toBe(true);
    expect(commands.every((command) => command.manufacturer === "DijkstraSim")).toBe(true);
    expect(commands.every((command) => command.speedMetersPerSecond === 2.5)).toBe(true);
  });

  it("falls back to the first map node when no start nodes are configured", () => {
    const [command] = buildStartupAgvCommands({
      map: createDemoMap(),
      agvCount: 1,
      serialPrefix: "UNIT",
      manufacturer: "TestMaker",
      startNodes: [],
    });

    expect(command?.serialNumber).toBe("UNIT-001");
    expect(command?.startNodeId).toBe("dock-a");
  });
});
