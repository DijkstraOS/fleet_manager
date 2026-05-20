import mqtt, { type MqttClient } from "mqtt";
import { VDA_5050_VERSION, type VdaOrder } from "@agv/core";
import { AgvClient, Topic } from "vda-5050-lib";
import {
  buildState,
  buildVisualization,
  type SimulatedAgv,
} from "../simulation";
import type {
  OrderEnvelope,
  SimulatorFleetPublisher,
} from "../services/simulator-fleet";

export interface MqttSimulatorTransportOptions {
  mqttBroker: string;
  interfaceName: string;
  log?: Pick<Console, "log" | "error"> | null;
  onOrder: (envelope: OrderEnvelope) => void;
}

export interface MqttSimulatorTransport extends SimulatorFleetPublisher {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createMqttSimulatorTransport(options: MqttSimulatorTransportOptions): MqttSimulatorTransport {
  const agvClients = new Map<string, ManagedAgvClient>();
  const pendingOperations = new Set<Promise<void>>();
  let statusClient: MqttClient | null = null;

  function publish(topic: string, value: unknown) {
    if (!statusClient?.connected) return;
    statusClient.publish(topic, JSON.stringify(value), { qos: 0 });
  }

  function ensureAgvClient(agv: SimulatedAgv): Promise<AgvClient> {
    const key = agvKey(agv.manufacturer, agv.serialNumber);
    const existing = agvClients.get(key);
    if (existing) return existing.ready;

    const client = new AgvClient({
      manufacturer: agv.manufacturer,
      serialNumber: agv.serialNumber,
    }, {
      interfaceName: options.interfaceName,
      transport: {
        brokerUrl: options.mqttBroker,
        clientId: `agv-simulator-${agv.serialNumber}-${Math.floor(Math.random() * 100000)}`,
        reconnectPeriod: 1000,
      },
      vdaVersion: VDA_5050_VERSION,
    });

    const ready = client.start()
      .then(async () => {
        options.log?.log(`[sim] ${agv.manufacturer}/${agv.serialNumber} connected to ${options.mqttBroker}`);
        await client.subscribe(Topic.Order, (order, subject) => {
          options.onOrder({
            manufacturer: subject.manufacturer,
            serialNumber: subject.serialNumber,
            order: order as VdaOrder,
          });
        });
        return client;
      })
      .catch((error) => {
        agvClients.delete(key);
        throw error;
      });

    agvClients.set(key, { ready });
    return ready;
  }

  function schedule(operation: Promise<void>) {
    let tracked: Promise<void>;
    tracked = operation
      .catch((error) => options.log?.error("[sim] vda mqtt error", error instanceof Error ? error.message : String(error)))
      .finally(() => pendingOperations.delete(tracked));
    pendingOperations.add(tracked);
  }

  function stopAgvClient(agv: SimulatedAgv) {
    const key = agvKey(agv.manufacturer, agv.serialNumber);
    const existing = agvClients.get(key);
    if (!existing) return;
    agvClients.delete(key);
    schedule(existing.ready.then((client) => client.stop()));
  }

  async function stopAllAgvClients() {
    const clients = Array.from(agvClients.values());
    agvClients.clear();
    await Promise.allSettled(clients.map((item) => item.ready.then((client) => client.stop())));
  }

  async function flushPendingOperations() {
    while (pendingOperations.size > 0) {
      await Promise.allSettled(Array.from(pendingOperations));
    }
  }

  function agvKey(manufacturer: string, serialNumber: string) {
    return `${manufacturer}/${serialNumber}`;
  }

  function connectMqtt(client: MqttClient): Promise<void> {
    return new Promise((resolve) => {
      if (client.connected) {
        resolve();
        return;
      }
      client.once("connect", () => resolve());
    });
  }

  function closeMqtt(client: MqttClient): Promise<void> {
    return new Promise((resolve, reject) => {
      client.end(true, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  return {
    start: async () => {
      if (statusClient) return;
      statusClient = mqtt.connect(options.mqttBroker, {
        clientId: `agv-simulator-status-${Math.floor(Math.random() * 100000)}`,
        reconnectPeriod: 1000,
      });
      statusClient.on("error", (error) => options.log?.error("[sim] mqtt status error", error.message));
      await connectMqtt(statusClient);
      options.log?.log(`[sim] status channel connected to ${options.mqttBroker}`);
    },

    stop: async () => {
      await flushPendingOperations();
      await stopAllAgvClients();
      await flushPendingOperations();
      const current = statusClient;
      statusClient = null;
      if (current) await closeMqtt(current);
    },

    publishAgv: (agv: SimulatedAgv) => {
      schedule(ensureAgvClient(agv).then(async (client) => {
        await client.publish(Topic.State, buildState(agv), { dropIfOffline: true });
        await client.publish(Topic.Visualization, buildVisualization(agv), { dropIfOffline: true });
      }));
    },

    publishConnection: (agv: SimulatedAgv, connectionState: "ONLINE" | "OFFLINE") => {
      if (connectionState === "OFFLINE") {
        stopAgvClient(agv);
      } else {
        schedule(ensureAgvClient(agv).then(async () => {}));
      }
    },

    publishOrderStatus: (data) => {
      publish(`${options.interfaceName}/server/order-status`, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    },
  };
}

interface ManagedAgvClient {
  ready: Promise<AgvClient>;
}
