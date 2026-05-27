import { expect, test } from "vitest";
import { loadSimulatorConfig } from "./env";

test("uses MQTT_PORT when MQTT_BROKER is not set", () => {
  const config = loadSimulatorConfig({
    MQTT_PORT: "1885",
  } as NodeJS.ProcessEnv, []);

  expect(config.mqttBroker).toBe("mqtt://127.0.0.1:1885");
});

test("keeps MQTT_BROKER as the explicit simulator broker contract", () => {
  const config = loadSimulatorConfig({
    MQTT_BROKER: "mqtt://broker.example:1883",
    MQTT_PORT: "1885",
  } as NodeJS.ProcessEnv, []);

  expect(config.mqttBroker).toBe("mqtt://broker.example:1883");
});
