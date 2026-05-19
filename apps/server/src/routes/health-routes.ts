import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(
  fastify: FastifyInstance,
  options: {
    mqttBrokerUrl: string;
    interfaceName: string;
  }
) {
  fastify.get("/api/health", async () => ({
    ok: true,
    mqtt: options.mqttBrokerUrl,
    interfaceName: options.interfaceName,
  }));
}
