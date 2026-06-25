import mqtt, { type MqttClient } from "mqtt";
import { VDA_5050_VERSION, delay, formatError, type ConnectionStatus, type VdaOrder, type VdaPublishedOrder, type VdaState, type VdaVisualization } from "@agv/core";
import { ConnectionState as VdaConnectionState, MasterControlClient, Topic, type AgvId } from "vda-5050-lib";
import type { FleetGateway, KnownAgv } from "../domain/ports";

export interface MqttFleetGatewayOptions {
  brokerUrl: string;
  interfaceName: string;
  onAgvState: (agv: KnownAgv) => void;
  onAgvVisualization: (agv: KnownAgv) => void;
  onOrderStatus: (data: Record<string, unknown>) => void;
}

export interface MqttFleetGateway extends FleetGateway {
  brokerUrl: string;
}

export function createMqttFleetGateway(options: MqttFleetGatewayOptions): MqttFleetGateway {
  const brokerUrl = options.brokerUrl;
  const agvs = new Map<string, KnownAgv>();
  let masterClient: MasterControlClient | null = null;
  let statusClient: MqttClient | null = null;

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
      await waitForMqttBroker(brokerUrl);

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

async function waitForMqttBroker(brokerUrl: string, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await probeMqttBroker(brokerUrl);
      return;
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }

  throw new Error(`MQTT broker ${brokerUrl} was not reachable within ${timeoutMs}ms: ${formatError(lastError)}`);
}

function probeMqttBroker(brokerUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, {
      clientId: `agv-server-probe-${Math.floor(Math.random() * 100000)}`,
      reconnectPeriod: 0,
      connectTimeout: 1000,
    });
    let settled = false;

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      client.end(true, () => {
        if (error) reject(error);
        else resolve();
      });
    }

    client.once("connect", () => finish());
    client.once("error", finish);
    client.once("close", () => finish(new Error("connection closed")));
  });
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
