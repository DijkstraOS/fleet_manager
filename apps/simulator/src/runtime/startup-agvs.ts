import type { MapDocument } from "@agv/core";
import type { CreateAgvCommand } from "../services/simulator-fleet";

export interface StartupAgvOptions {
  map: MapDocument;
  agvCount: number;
  serialPrefix: string;
  manufacturer: string;
  startNodes: string[];
  speedMetersPerSecond?: number;
}

export function buildStartupAgvCommands(options: StartupAgvOptions): CreateAgvCommand[] {
  const count = Math.max(0, Math.floor(options.agvCount));
  return Array.from({ length: count }, (_, index) => {
    const command: CreateAgvCommand = {
      serialNumber: formatSerial(options.serialPrefix, index + 1),
      manufacturer: options.manufacturer,
      map: options.map,
    };
    const startNodeId = options.startNodes.length > 0
      ? options.startNodes[index % options.startNodes.length]
      : options.map.nodes[0]?.id;
    if (startNodeId !== undefined) command.startNodeId = startNodeId;
    if (options.speedMetersPerSecond !== undefined) {
      command.speedMetersPerSecond = options.speedMetersPerSecond;
    }
    return command;
  });
}

function formatSerial(prefix: string, index: number) {
  return `${prefix}-${String(index).padStart(3, "0")}`;
}
