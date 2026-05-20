import { createRequire } from "node:module";
import net from "node:net";
import mqtt, { type MqttClient } from "mqtt";
import type { createBroker as createBrokerType } from "aedes";
import { VDA_5050_VERSION, type ConnectionStatus, type VdaOrder, type VdaPublishedOrder, type VdaState, type VdaVisualization } from "@agv/core";
import { ConnectionState as VdaConnectionState, MasterControlClient, Topic, type AgvId } from "vda-5050-lib";
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
  let masterClient: MasterControlClient | null = null;
  let statusClient: MqttClient | null = null;
  let started = false;

  function parse(payload: Buffer): Record<string, unknown> {
    try {
      return JSON.parse(payload.toString()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  function handleStatusMessage(topic: string, payload: Buffer) {
    if (topic === `${options.interfaceName}/server/order-status`) {
      options.onOrderStatus(parse(payload));
    }
  }

  function upsertAgv(subject: AgvId): KnownAgv {
    const existing = agvs.get(subject.serialNumber);
    const agv: KnownAgv = existing || {
      serialNumber: subject.serialNumber,
      manufacturer: subject.manufacturer,
      mapId: null,
      connectionState: null,
      state: null,
      visualization: null,
      lastSeenAt: new Date().toISOString(),
    };
    agv.manufacturer = subject.manufacturer;
    agv.lastSeenAt = new Date().toISOString();
    agvs.set(subject.serialNumber, agv);
    return agv;
  }

  function toConnectionStatus(state: VdaConnectionState): ConnectionStatus {
    if (state === VdaConnectionState.Offline) return "OFFLINE";
    if (state === VdaConnectionState.Connectionbroken) return "CONNECTIONBROKEN";
    return "ONLINE";
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

      masterClient = new MasterControlClient({
        interfaceName: options.interfaceName,
        transport: {
          brokerUrl,
          clientId: "agv-server-master",
          reconnectPeriod: 1000,
        },
        vdaVersion: VDA_5050_VERSION,
      });

      masterClient.trackAgvs((subject, state) => {
        const agv = upsertAgv(subject);
        agv.connectionState = toConnectionStatus(state);
        options.onAgvState(agv);
      });
      await masterClient.start();
      await masterClient.subscribe(Topic.State, {}, (state, subject) => {
        const agv = upsertAgv(subject);
        agv.state = state as VdaState;
        agv.mapId = state.agvPosition?.mapId || agv.mapId;
        options.onAgvState(agv);
      });
      await masterClient.subscribe(Topic.Visualization, {}, (visualization, subject) => {
        const agv = upsertAgv(subject);
        agv.visualization = visualization as VdaVisualization;
        agv.mapId = visualization.agvPosition?.mapId || agv.mapId;
        options.onAgvVisualization(agv);
      });

      statusClient = mqtt.connect(brokerUrl, { clientId: "agv-server-status", reconnectPeriod: 1000 });
      await connectMqtt(statusClient);
      await subscribeMqtt(statusClient, `${options.interfaceName}/server/order-status`);
      statusClient.on("message", handleStatusMessage);
    },

    close: async () => {
      const activeStatusClient = statusClient;
      statusClient = null;
      if (activeStatusClient) await closeMqtt(activeStatusClient);
      const activeMasterClient = masterClient;
      masterClient = null;
      if (activeMasterClient) await activeMasterClient.stop();
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
    publishOrder: async (agv: KnownAgv, order: VdaOrder): Promise<VdaPublishedOrder | undefined> => {
      if (!masterClient) throw new Error("VDA 5050 master control client is not connected.");
      return masterClient.publish(Topic.Order, {
        manufacturer: agv.manufacturer,
        serialNumber: agv.serialNumber,
      }, order);
    },
  };
}

function connectMqtt(client: MqttClient): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("error", reject);
  });
}

function subscribeMqtt(client: MqttClient, topic: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, (error) => {
      if (error) reject(error);
      else resolve();
    });
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
