import type { MapDocument } from "@agv/core";
import type { SimulatedAgv } from "../simulation";
import { createMapClient, type MapClient } from "../services/map-client";
import { createSimulatorFleet } from "../services/simulator-fleet";
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
  listAgvs: () => SimulatedAgv[];
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
  let fleet = createSimulatorFleet({ publisher: nullPublisher, log: logger });

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
    listAgvs: () => fleet.listAgvs(),
  };
}

async function loadMapWithRetry(mapClient: MapClient, mapId?: string, timeoutMs = 30_000): Promise<MapDocument> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await loadMap(mapClient, mapId);
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }

  throw new Error(`Could not load simulator map within ${timeoutMs}ms: ${formatError(lastError)}`);
}

async function loadMap(mapClient: MapClient, mapId?: string): Promise<MapDocument> {
  if (mapId) return mapClient.getMap(mapId);
  const maps = await mapClient.listMaps();
  const first = maps[0];
  if (!first) throw new Error("No maps available for simulator startup.");
  return mapClient.getMap(first.id);
}

const nullPublisher = {
  publishAgv: () => {},
  publishConnection: () => {},
  publishOrderStatus: () => {},
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
