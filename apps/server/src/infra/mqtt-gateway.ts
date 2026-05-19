import { createRequire } from "node:module";
import net from "node:net";
import mqtt, { type MqttClient } from "mqtt";
import type { createBroker as createBrokerType } from "aedes";
import type { VdaOrder, VdaState, VdaVisualization } from "@agv/core";
import type { FleetGateway, KnownAgv } from "../domain/ports";

const require = createRequire(import.meta.url);
const createBroker = require("aedes") as typeof createBrokerType;

export interface MqttFleetGatewayOptions {
  port: number;
  interfaceName: string;
  onAgvState: (agv: KnownAgv) => void;
  onAgvVisualization: (agv: KnownAgv) => void;
  onOrderStatus: (data: Record<string, unknown>) => void;
}

export interface MqttFleetGateway extends FleetGateway {
  brokerUrl: string;
}

export function createMqttFleetGateway(options: MqttFleetGatewayOptions): MqttFleetGateway {
  const brokerUrl = `mqtt://127.0.0.1:${options.port}`;
  const broker = createBroker();
  const brokerServer = net.createServer(broker.handle);
  const agvs = new Map<string, KnownAgv>();
  let client: MqttClient | null = null;
  let started = false;

  function parse(payload: Buffer): Record<string, unknown> {
    try {
      return JSON.parse(payload.toString()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  function publish(topic: string, value: unknown) {
    if (!client) throw new Error("MQTT client is not connected.");
    client.publish(topic, JSON.stringify(value), { qos: 0 });
  }

  function handleMessage(topic: string, payload: Buffer) {
    const parts = topic.split("/");
    if (topic === `${options.interfaceName}/server/order-status`) {
      options.onOrderStatus(parse(payload));
      return;
    }
    if (parts.length < 5 || parts[0] !== options.interfaceName || parts[1] !== "v2") return;

    const manufacturer = parts[2];
    const serialNumber = parts[3];
    const kind = parts[4];
    if (!manufacturer || !serialNumber || !kind) return;

    const existing = agvs.get(serialNumber);
    const agv: KnownAgv = existing || {
      serialNumber,
      manufacturer,
      mapId: null,
      connectionState: null,
      state: null,
      visualization: null,
      lastSeenAt: new Date().toISOString(),
    };
    agv.lastSeenAt = new Date().toISOString();

    if (kind === "state") {
      const state = parse(payload) as unknown as VdaState;
      agv.state = state;
      agv.mapId = state.agvPosition.mapId || agv.mapId;
      agvs.set(serialNumber, agv);
      options.onAgvState(agv);
    }

    if (kind === "visualization") {
      const visualization = parse(payload) as unknown as VdaVisualization;
      agv.visualization = visualization;
      agv.mapId = visualization.agvPosition.mapId || agv.mapId;
      agvs.set(serialNumber, agv);
      options.onAgvVisualization(agv);
    }

    if (kind === "connection") {
      const connection = parse(payload);
      agv.connectionState = connection.connectionState === "OFFLINE" ? "OFFLINE" : "ONLINE";
      agvs.set(serialNumber, agv);
      options.onAgvState(agv);
    }
  }

  return {
    brokerUrl,

    start: async () => {
      await new Promise<void>((resolve, reject) => {
        brokerServer.once("error", reject);
        brokerServer.listen(options.port, () => {
          brokerServer.off("error", reject);
          started = true;
          resolve();
        });
      });

      client = mqtt.connect(brokerUrl, { clientId: "agv-server-master" });
      await new Promise<void>((resolve, reject) => {
        if (!client) return reject(new Error("MQTT client not initialized."));
        client.once("connect", () => resolve());
        client.once("error", reject);
      });

      client.subscribe(`${options.interfaceName}/v2/+/+/state`);
      client.subscribe(`${options.interfaceName}/v2/+/+/visualization`);
      client.subscribe(`${options.interfaceName}/v2/+/+/connection`);
      client.subscribe(`${options.interfaceName}/server/order-status`);
      client.on("message", handleMessage);
    },

    close: async () => {
      const activeClient = client;
      client = null;
      if (activeClient) {
        await new Promise<void>((resolve, reject) => {
          activeClient.end(true, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
      if (started) {
        await new Promise<void>((resolve, reject) => {
          brokerServer.close((error) => {
            if (error) reject(error);
            else {
              started = false;
              resolve();
            }
          });
        });
      }
      await new Promise<void>((resolve) => broker.close(resolve));
    },

    listAgvs: () => Array.from(agvs.values()),
    getAgv: (serialNumber) => agvs.get(serialNumber),
    publishOrder: (agv: KnownAgv, order: VdaOrder) => {
      publish(`${options.interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/order`, order);
    },
  };
}
