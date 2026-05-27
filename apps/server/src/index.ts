import { createAgvServer } from "./app";

const port = Number(process.env.PORT || 4000);
const mqttBroker = process.env.MQTT_BROKER || `mqtt://127.0.0.1:${process.env.MQTT_PORT || 1883}`;
const interfaceName = process.env.INTERFACE_NAME || "agv-new";
const mapStorePath = process.env.MAP_STORE_PATH;
const routeStorePath = process.env.ROUTE_STORE_PATH;

const server = await createAgvServer({
  port,
  mqttBroker,
  interfaceName,
  ...(mapStorePath ? { mapStorePath } : {}),
  ...(routeStorePath ? { routeStorePath } : {}),
});

await server.start();

server.fastify.log.info(`AGV server listening on http://localhost:${port}`);
server.fastify.log.info(`AGV server connected to MQTT broker ${server.mqttHub.brokerUrl}`);
