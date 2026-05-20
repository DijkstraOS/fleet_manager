import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.PLAYWRIGHT_WEB_PORT || "6173";
const apiPort = process.env.PLAYWRIGHT_API_PORT || "4100";
const mqttPort = process.env.PLAYWRIGHT_MQTT_PORT || "1884";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: webBase,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: webBase,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: apiPort,
      MQTT_PORT: mqttPort,
      SERVER_URL: apiBase,
      MQTT_BROKER: `mqtt://127.0.0.1:${mqttPort}`,
      VITE_WEB_PORT: webPort,
      VITE_API_TARGET: apiBase,
      MAP_STORE_PATH: `/tmp/agv-new-e2e-${runId}/maps.json`,
      ROUTE_STORE_PATH: `/tmp/agv-new-e2e-${runId}/routes.json`,
    },
  },
});
