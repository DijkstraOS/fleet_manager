import { createAgvServer } from "./app.js";

const port = Number(process.env.PORT || 4000);
const mqttPort = Number(process.env.MQTT_PORT || 1883);
const interfaceName = process.env.INTERFACE_NAME || "agv-new";

const server = await createAgvServer({
  port,
  mqttPort,
  interfaceName,
});

await server.start();

server.fastify.log.info(`AGV server listening on http://localhost:${port}`);
server.fastify.log.info(`MQTT broker listening on ${server.mqttHub.brokerUrl}`);
