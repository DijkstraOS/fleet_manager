import { createSimulatorClient } from "./runtime.js";

const runtime = createSimulatorClient({
  mqttBroker: process.env.MQTT_BROKER || "mqtt://127.0.0.1:1883",
  interfaceName: process.env.INTERFACE_NAME || "agv-new",
  defaultSerial: process.env.AGV_SERIAL || "SIM-001",
  defaultManufacturer: process.env.AGV_MANUFACTURER || "DijkstraSim",
});

await runtime.start();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  await runtime.stop();
  process.exit(0);
}
