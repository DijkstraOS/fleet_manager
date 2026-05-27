import { createLocalBroker } from "./runtime";

const port = Number(process.env.MQTT_PORT || 1883);
const host = process.env.MQTT_HOST || "127.0.0.1";
const broker = createLocalBroker({ port, host });

broker.start().catch((error) => {
  console.error(`[broker] failed to start ${broker.brokerUrl}`, error);
  process.exit(1);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  try {
    await broker.close();
    process.exit(0);
  } catch (error) {
    console.error("[broker] failed to shut down cleanly", error);
    process.exit(1);
  }
}
