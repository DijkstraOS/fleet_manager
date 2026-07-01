import { retryUntil, type MapDocument } from "@agv/core";
import { createMapClient, type MapClient } from "../services/map-client";
import { createSimulatorFleet, type SimulatorFleet } from "../services/simulator-fleet";
import { createMqttSimulatorTransport } from "../transport/mqtt-simulator-transport";
import { createSimulatorLoop } from "./simulator-loop";
import { buildStartupAgvCommands } from "./startup-agvs";

export interface SimulatorClientOptions {
  serverUrl?: string;
  mqttBroker?: string;
  interfaceName?: string;
  mapId?: string;
  agvCount?: number;
  serialPrefix?: string;
  manufacturer?: string;
  startNodes?: string[];
  speedMetersPerSecond?: number;
  log?: Pick<Console, "log" | "error"> | false;
  mapClient?: MapClient;
}

export interface SimulatorClientRuntime {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createSimulatorClient(options: SimulatorClientOptions = {}): SimulatorClientRuntime {
  const serverUrl = options.serverUrl ?? "http://127.0.0.1:4000";
  const mqttBroker = options.mqttBroker ?? "mqtt://127.0.0.1:1883";
  const interfaceName = options.interfaceName ?? "agv-new";
  const agvCount = Math.max(0, Math.floor(options.agvCount ?? 1));
  const serialPrefix = options.serialPrefix ?? "SIM";
  const manufacturer = options.manufacturer ?? "DijkstraSim";
  const startNodes = options.startNodes ?? [];
  const logger = options.log === false ? null : options.log ?? console;
  const mapClient = options.mapClient ?? createMapClient(serverUrl);
  let fleet: SimulatorFleet;

  const transport = createMqttSimulatorTransport({
    mqttBroker,
    interfaceName,
    log: logger,
    onOrder: (envelope) => fleet.acceptOrder(envelope),
  });
  fleet = createSimulatorFleet({ publisher: transport, log: logger });
  const loop = createSimulatorLoop({
    onMotionTick: (dtMs) => fleet.tickMotion(dtMs),
    onPublishTick: () => fleet.publishAllAgvs(),
  });

  return {
    start: async () => {
      await transport.start();
      const map = await loadMapWithRetry(mapClient, options.mapId);
      for (const command of buildStartupAgvCommands({
          map,
          agvCount,
          serialPrefix,
          manufacturer,
          startNodes,
          ...(options.speedMetersPerSecond !== undefined
            ? { speedMetersPerSecond: options.speedMetersPerSecond }
            : {}),
        })) {
        fleet.createAgv(command);
      }
      loop.start();
    },
    stop: async () => {
      loop.stop();
      fleet.shutdown();
      await transport.stop();
    },
  };
}

function loadMapWithRetry(mapClient: MapClient, mapId?: string, timeoutMs = 30_000): Promise<MapDocument> {
  return retryUntil(() => loadMap(mapClient, mapId), {
    timeoutMs,
    describe: "Could not load simulator map",
  });
}

async function loadMap(mapClient: MapClient, mapId?: string): Promise<MapDocument> {
  if (mapId) return mapClient.getMap(mapId);
  const maps = await mapClient.listMaps();
  const first = maps[0];
  if (!first) throw new Error("No maps available for simulator startup.");
  return mapClient.getMap(first.id);
}
