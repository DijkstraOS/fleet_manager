import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  buildVdaOrder,
  exportLifDocument,
  type MapDocument,
  type OrderDraft,
} from "@agv/core";
import { MapStore } from "./store.js";
import { RealtimeHub } from "./realtime.js";
import { MqttHub } from "./mqtt-hub.js";

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
  store: MapStore;
  mqttHub: MqttHub;
  realtime: RealtimeHub;
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

  const store = new MapStore(options.mapStorePath);
  await store.load();

  const realtime = new RealtimeHub(fastify.server);
  const mqttHub = new MqttHub({
    port: mqttPort,
    interfaceName,
    onAgvState: (agv) => {
      realtime.broadcast({
        type: "agv_state",
        serialNumber: agv.serialNumber,
        manufacturer: agv.manufacturer,
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

  fastify.get("/api/health", async () => ({
    ok: true,
    mqtt: mqttHub.brokerUrl,
    interfaceName,
  }));

  fastify.get("/api/maps", async () => store.list());

  fastify.get<{ Params: { id: string } }>("/api/maps/:id", async (request, reply) => {
    const map = store.get(request.params.id);
    if (!map) return reply.code(404).send({ error: "Map not found." });
    return map;
  });

  fastify.post<{ Body: MapDocument }>("/api/maps", async (request, reply) => {
    try {
      const map = await store.upsert(request.body);
      realtime.broadcast({ type: "map_updated", map });
      return map;
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid map.",
      });
    }
  });

  fastify.post<{ Params: { id: string } }>("/api/maps/:id/export-lif", async (request, reply) => {
    const map = store.get(request.params.id);
    if (!map) return reply.code(404).send({ error: "Map not found." });
    return exportLifDocument(map);
  });

  fastify.get("/api/agvs", async () => mqttHub.listAgvs());

  fastify.post<{
    Body: {
      serialNumber?: string;
      manufacturer?: string;
      mapId: string;
      startNodeId?: string;
      speedMetersPerSecond?: number;
    };
  }>("/api/sim/agvs", async (request, reply) => {
    const map = store.get(request.body.mapId);
    if (!map) return reply.code(404).send({ error: "Map not found." });
    const startNodeId = request.body.startNodeId || map.nodes[0]?.id;
    if (!startNodeId) return reply.code(400).send({ error: "Map needs at least one node." });

    const serialNumber = request.body.serialNumber || "SIM-001";
    const manufacturer = request.body.manufacturer || "DijkstraSim";
    const simRequest: {
      serialNumber: string;
      manufacturer: string;
      map: MapDocument;
      startNodeId: string;
      speedMetersPerSecond?: number;
    } = {
      serialNumber,
      manufacturer,
      map,
      startNodeId,
    };
    if (request.body.speedMetersPerSecond !== undefined) {
      simRequest.speedMetersPerSecond = request.body.speedMetersPerSecond;
    }
    mqttHub.requestSimulatedAgv(simRequest);
    return { ok: true, serialNumber, manufacturer, mapId: map.id, startNodeId };
  });

  fastify.post<{ Body: OrderDraft }>("/api/orders", async (request, reply) => {
    const map = store.get(request.body.mapId);
    if (!map) return reply.code(404).send({ error: "Map not found." });
    const agv = mqttHub.getAgv(request.body.agvSerialNumber);
    if (!agv) return reply.code(404).send({ error: "AGV not connected." });

    try {
      const order = buildVdaOrder(map, request.body);
      mqttHub.publishOrder(agv, order);
      const payload = {
        status: "sent",
        orderId: order.orderId,
        serialNumber: agv.serialNumber,
        timestamp: new Date().toISOString(),
      };
      realtime.broadcast({ type: "order_status", ...payload });
      return { ok: true, order };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid order.",
      });
    }
  });

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
