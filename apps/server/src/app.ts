import { dirname, resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createFileMapRepository } from "./infra/file-map-repository";
import { createFileRouteRepository } from "./infra/file-route-repository";
import { createMqttFleetGateway, type MqttFleetGateway } from "./infra/mqtt-gateway";
import { createRealtimePublisher } from "./infra/websocket-realtime-publisher";
import { createFleetHandlers } from "./services/fleet-service";
import { createMapHandlers } from "./services/map-service";
import { createOrderHandlers, createOrderTracker } from "./services/order-service";
import { createRouteHandlers } from "./services/route-service";
import {
  registerFleetRoutes,
  registerHealthRoutes,
  registerMapRoutes,
  registerOrderRoutes,
  registerRouteRoutes,
} from "./routes/index";
import type { MapRepository, RealtimePublisher, RouteRepository } from "./domain/ports";

export interface AgvServerOptions {
  port?: number;
  host?: string;
  mqttBroker?: string;
  interfaceName?: string;
  mapStorePath?: string;
  routeStorePath?: string;
  logger?: boolean;
}

export interface AgvServerRuntime {
  fastify: FastifyInstance;
  store: MapRepository;
  routeStore: RouteRepository;
  mqttHub: MqttFleetGateway;
  realtime: RealtimePublisher;
  port: number;
  mqttBroker: string;
  interfaceName: string;
  start: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createAgvServer(options: AgvServerOptions = {}): Promise<AgvServerRuntime> {
  const port = options.port ?? 4000;
  const mqttBroker = options.mqttBroker ?? "mqtt://127.0.0.1:1883";
  const host = options.host ?? "0.0.0.0";
  const interfaceName = options.interfaceName ?? "agv-new";

  const fastify = Fastify({ logger: options.logger ?? true });
  await fastify.register(cors, { origin: true });

  const store = createFileMapRepository(options.mapStorePath);
  await store.load();
  const routeStorePath = options.routeStorePath
    ?? (options.mapStorePath ? resolve(dirname(options.mapStorePath), "routes.json") : undefined);
  const routeStore = createFileRouteRepository(routeStorePath);
  await routeStore.load();

  const realtime = createRealtimePublisher(fastify.server);
  const orderTracker = createOrderTracker();
  const mqttHub = createMqttFleetGateway({
    brokerUrl: mqttBroker,
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
      realtime.broadcast({ type: "order_status", ...orderTracker.enrich(data) });
    },
  });

  registerHealthRoutes(fastify, { mqttBrokerUrl: mqttHub.brokerUrl, interfaceName });
  registerMapRoutes(fastify, createMapHandlers(store, realtime));
  registerRouteRoutes(fastify, createRouteHandlers(routeStore, store, realtime));
  registerFleetRoutes(fastify, createFleetHandlers(mqttHub));
  registerOrderRoutes(fastify, createOrderHandlers(store, mqttHub, realtime, orderTracker));

  return {
    fastify,
    store,
    routeStore,
    mqttHub,
    realtime,
    port,
    mqttBroker,
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
