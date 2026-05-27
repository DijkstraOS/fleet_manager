import type { SimulatorClientOptions } from "../runtime/simulator-client";

export function loadSimulatorConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv = process.argv.slice(2)
): SimulatorClientOptions {
  const args = parseArgs(argv);
  const mqttPort = readNumber(args, "mqtt-port", env.MQTT_PORT) ?? 1883;
  const config: SimulatorClientOptions = {
    serverUrl: readString(args, "server-url", env.SERVER_URL) || "http://127.0.0.1:4000",
    mqttBroker: readString(args, "mqtt-broker", env.MQTT_BROKER) || `mqtt://127.0.0.1:${mqttPort}`,
    interfaceName: readString(args, "interface-name", env.INTERFACE_NAME) || "agv-new",
    agvCount: readNumber(args, "agvs", env.AGV_COUNT) ?? 1,
    serialPrefix: readString(args, "serial-prefix", env.SERIAL_PREFIX) || "SIM",
    manufacturer: readString(args, "manufacturer", env.AGV_MANUFACTURER) || "DijkstraSim",
    startNodes: splitList(readString(args, "start-nodes", env.START_NODES)),
  };
  const mapId = readString(args, "map-id", env.MAP_ID);
  const speedMetersPerSecond = readNumber(args, "speed", env.AGV_SPEED);
  if (mapId !== undefined && mapId !== "") config.mapId = mapId;
  if (speedMetersPerSecond !== undefined) config.speedMetersPerSecond = speedMetersPerSecond;
  return config;
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    if (!rawKey) continue;
    const nextValue = argv[index + 1];
    if (inlineValue !== undefined) {
      args.set(rawKey, inlineValue);
    } else if (nextValue && !nextValue.startsWith("--")) {
      args.set(rawKey, nextValue);
      index += 1;
    } else {
      args.set(rawKey, "true");
    }
  }
  return args;
}

function readString(args: Map<string, string>, key: string, fallback?: string) {
  return args.get(key) ?? fallback;
}

function readNumber(args: Map<string, string>, key: string, fallback?: string) {
  const value = readString(args, key, fallback);
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitList(value?: string) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) || [];
}
