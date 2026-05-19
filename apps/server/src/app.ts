import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createFileMapRepository } from "./infra/file-map-repository";
import { createMqttFleetGateway, type MqttFleetGateway } from "./infra/mqtt-gateway";
import { createRealtimePublisher } from "./infra/websocket-realtime-publisher";
import { createFleetHandlers } from "./services/fleet-service";
import { createMapHandlers } from "./services/map-service";
import { createOrderHandlers } from "./services/order-service";
import {
  registerFleetRoutes,
  registerHealthRoutes,
  registerMapRoutes,
  registerOrderRoutes,
} from "./routes/index";
import type { MapRepository, RealtimePublisher } from "./domain/ports";

export interface AgvServerOptions {
  port?: number;
  host?: string;
  mqttPort?: number;
  interfaceName?: string;
  mapStorePath?: string;
  logger?: boolean;
}

export interface AgvServerRuntime {
  fastify: FastifyInstance;
  store: MapRepository;
  mqttHub: MqttFleetGateway;
  realtime: RealtimePublisher;
  port: number;
  mqttPort: number;
  interfaceName: string;
  start: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createAgvServer(options: AgvServerOptions = {}): Promise<AgvServerRuntime> {
  const port = options.port ?? 4000;
  const mqttPort = options.mqttPort ?? 1883;
  const host = options.host ?? "0.0.0.0";
  const interfaceName = options.interfaceName ?? "agv-new";

  const fastify = Fastify({ logger: options.logger ?? true });
  await fastify.register(cors, { origin: true });

  const store = createFileMapRepository(options.mapStorePath);
  await store.load();

  const realtime = createRealtimePublisher(fastify.server);
  const mqttHub = createMqttFleetGateway({
    port: mqttPort,
    interfaceName,
    onAgvState: (agv) => {
      realtime.broadcast({
        type: "agv_state",
        serialNumber: agv.serialNumber,
        manufacturer: agv.manufacturer,
        connectionState: agv.connectionState,
        state: agv.state,
      });
    },
    onAgvVisualization: (agv) => {
      realtime.broadcast({
        type: "agv_visualization",
        serialNumber: agv.serialNumber,
        manufacturer: agv.manufacturer,
        visualization: agv.visualization,
      });
    },
    onOrderStatus: (data) => {
      realtime.broadcast({ type: "order_status", ...data });
    },
  });

  registerHealthRoutes(fastify, { mqttBrokerUrl: mqttHub.brokerUrl, interfaceName });
  registerMapRoutes(fastify, createMapHandlers(store, realtime));
  registerFleetRoutes(fastify, createFleetHandlers(mqttHub));
  registerOrderRoutes(fastify, createOrderHandlers(store, mqttHub, realtime));

  return {
    fastify,
    store,
    mqttHub,
    realtime,
    port,
    mqttPort,
    interfaceName,
    start: async () => {
      await mqttHub.start();
      await fastify.listen({ port, host });
    },
    close: async () => {
      await realtime.close();
      await fastify.close();
      await mqttHub.close();
    },
  };
}
