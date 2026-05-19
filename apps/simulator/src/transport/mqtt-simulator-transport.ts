import mqtt, { type MqttClient } from "mqtt";
import type { VdaOrder } from "@agv/core";
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
  let client: MqttClient | null = null;

  function publish(topic: string, value: unknown) {
    if (!client?.connected) return;
    client.publish(topic, JSON.stringify(value), { qos: 0 });
  }

  function handleMessage(topic: string, payload: Buffer) {
    const parts = topic.split("/");
    if (parts.length < 5 || parts[0] !== options.interfaceName || parts[4] !== "order") return;

    const manufacturer = parts[2];
    const serialNumber = parts[3];
    if (!manufacturer || !serialNumber) return;

    options.onOrder({
      manufacturer,
      serialNumber,
      order: parse(payload) as unknown as VdaOrder,
    });
  }

  return {
    start: async () => {
      if (client) return;
      client = mqtt.connect(options.mqttBroker, {
        clientId: `agv-simulator-${Math.floor(Math.random() * 100000)}`,
        reconnectPeriod: 1000,
      });

      let initialSubscriptionResolve: (() => void) | null = null;
      let initialSubscriptionReject: ((error: Error) => void) | null = null;
      let initialSubscriptionSettled = false;

      client.on("connect", () => {
        options.log?.log(`[sim] connected to ${options.mqttBroker}`);
        client?.subscribe(`${options.interfaceName}/v2/+/+/order`, (error) => {
          if (!initialSubscriptionSettled) {
            initialSubscriptionSettled = true;
            if (error) initialSubscriptionReject?.(error);
            else initialSubscriptionResolve?.();
          }
        });
      });
      client.on("message", handleMessage);
      client.on("error", (error) => options.log?.error("[sim] mqtt error", error.message));

      await new Promise<void>((resolve, reject) => {
        initialSubscriptionResolve = resolve;
        initialSubscriptionReject = reject;
      });
    },

    stop: async () => {
      const current = client;
      client = null;
      if (current) {
        await new Promise<void>((resolve, reject) => {
          current.end(true, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
    },

    publishAgv: (agv: SimulatedAgv) => {
      publish(`${options.interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/state`, buildState(agv));
      publish(`${options.interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/visualization`, buildVisualization(agv));
    },

    publishConnection: (agv: SimulatedAgv, connectionState: "ONLINE" | "OFFLINE") => {
      publish(`${options.interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/connection`, {
        connectionState,
      });
    },

    publishOrderStatus: (data) => {
      publish(`${options.interfaceName}/server/order-status`, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    },
  };
}

function parse(payload: Buffer): Record<string, unknown> {
  try {
    return JSON.parse(payload.toString()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
