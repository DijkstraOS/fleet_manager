import { createSimulatorClient } from "./runtime";
import { loadSimulatorConfig } from "./config/env";

const runtime = createSimulatorClient(loadSimulatorConfig());

await runtime.start();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  await runtime.stop();
  process.exit(0);
}
