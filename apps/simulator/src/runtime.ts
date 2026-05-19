import mqtt, { type MqttClient } from "mqtt";
import {
  acceptOrder,
  advanceAgv,
  buildState,
  buildVisualization,
  createSimulatedAgv,
  type MapDocument,
  type SimulatedAgv,
  type VdaOrder,
} from "@agv/core";

export interface SimulatorClientOptions {
  mqttBroker?: string;
  interfaceName?: string;
  defaultSerial?: string;
  defaultManufacturer?: string;
  log?: Pick<Console, "log" | "error"> | false;
}

export interface SimulatorClientRuntime {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  listAgvs: () => SimulatedAgv[];
}

export function createSimulatorClient(options: SimulatorClientOptions = {}): SimulatorClientRuntime {
  const mqttBroker = options.mqttBroker ?? "mqtt://127.0.0.1:1883";
  const interfaceName = options.interfaceName ?? "agv-new";
  const defaultSerial = options.defaultSerial ?? "SIM-001";
  const defaultManufacturer = options.defaultManufacturer ?? "DijkstraSim";
  const logger = options.log === false ? null : options.log ?? console;
  const activeAgvs = new Map<string, SimulatedAgv>();
  let client: MqttClient | null = null;
  let lastTick = Date.now();
  let motionTimer: ReturnType<typeof setInterval> | null = null;
  let publishTimer: ReturnType<typeof setInterval> | null = null;

  function handleMessage(topic: string, payload: Buffer) {
    if (topic === `${interfaceName}/sim/create`) {
      const message = parse(payload) as {
        serialNumber?: string;
        manufacturer?: string;
        map?: MapDocument;
        startNodeId?: string;
        speedMetersPerSecond?: number;
      };
      if (!message.map) return;
      const serialNumber = message.serialNumber || defaultSerial;
      const manufacturer = message.manufacturer || defaultManufacturer;
      const createParams: {
        serialNumber: string;
        manufacturer: string;
        map: MapDocument;
        startNodeId?: string;
        speedMetersPerSecond?: number;
      } = {
        serialNumber,
        manufacturer,
        map: message.map,
      };
      if (message.startNodeId !== undefined) createParams.startNodeId = message.startNodeId;
      if (message.speedMetersPerSecond !== undefined) {
        createParams.speedMetersPerSecond = message.speedMetersPerSecond;
      }
      const agv = createSimulatedAgv(createParams);
      activeAgvs.set(serialNumber, agv);
      publishConnection(agv, "ONLINE");
      publishAgv(agv);
      logger?.log(`[sim] created ${manufacturer}/${serialNumber} on ${agv.currentNodeId}`);
      return;
    }

    const parts = topic.split("/");
    if (parts.length < 5 || parts[0] !== interfaceName || parts[4] !== "order") return;

    const manufacturer = parts[2];
    const serialNumber = parts[3];
    if (!manufacturer || !serialNumber) return;
    const current = activeAgvs.get(serialNumber);
    if (!current) return;

    const order = parse(payload) as unknown as VdaOrder;
    const next = acceptOrder(current, order);
    activeAgvs.set(serialNumber, next);
    publishOrderStatus({ status: "received", orderId: order.orderId, serialNumber });
    publishAgv(next);
    logger?.log(`[sim] ${serialNumber} received order ${order.orderId}`);
  }

  function tickMotion() {
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;

    for (const [serialNumber, agv] of activeAgvs) {
      const previousOrderId = agv.currentOrder?.orderId || "";
      const next = advanceAgv(agv, dt);
      activeAgvs.set(serialNumber, next);

      if (previousOrderId && !next.currentOrder) {
        publishOrderStatus({
          status: "completed",
          orderId: previousOrderId,
          serialNumber,
        });
        logger?.log(`[sim] ${serialNumber} completed ${previousOrderId}`);
      }
    }
  }

  function publishAllAgvs() {
    for (const agv of activeAgvs.values()) {
      publishAgv(agv);
    }
  }

  function publishAgv(agv: SimulatedAgv) {
    publish(`${interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/state`, buildState(agv));
    publish(`${interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/visualization`, buildVisualization(agv));
  }

  function publishConnection(agv: SimulatedAgv, connectionState: "ONLINE" | "OFFLINE") {
    publish(`${interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/connection`, {
      connectionState,
    });
  }

  function publishOrderStatus(data: {
    status: "received" | "completed" | "failed";
    orderId: string;
    serialNumber: string;
  }) {
    publish(`${interfaceName}/server/order-status`, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  function publish(topic: string, value: unknown) {
    if (!client?.connected) return;
    client.publish(topic, JSON.stringify(value), { qos: 0 });
  }

  return {
    start: async () => {
      if (client) return;
      client = mqtt.connect(mqttBroker, {
        clientId: `agv-simulator-${Math.floor(Math.random() * 100000)}`,
        reconnectPeriod: 1000,
      });

      let initialSubscriptionResolve: (() => void) | null = null;
      let initialSubscriptionReject: ((error: Error) => void) | null = null;
      let initialSubscriptionSettled = false;
      client.on("connect", () => {
        logger?.log(`[sim] connected to ${mqttBroker}`);
        client?.subscribe(
          [`${interfaceName}/sim/create`, `${interfaceName}/v2/+/+/order`],
          (error) => {
            if (!initialSubscriptionSettled) {
              initialSubscriptionSettled = true;
              if (error) initialSubscriptionReject?.(error);
              else initialSubscriptionResolve?.();
            }
          }
        );
      });
      client.on("message", (topic, payload) => handleMessage(topic, payload));
      client.on("error", (error) => logger?.error("[sim] mqtt error", error.message));

      await new Promise<void>((resolve, reject) => {
        initialSubscriptionResolve = resolve;
        initialSubscriptionReject = reject;
      });

      lastTick = Date.now();
      motionTimer = setInterval(tickMotion, 100);
      publishTimer = setInterval(publishAllAgvs, 250);
    },

    stop: async () => {
      if (motionTimer) clearInterval(motionTimer);
      if (publishTimer) clearInterval(publishTimer);
      motionTimer = null;
      publishTimer = null;

      for (const agv of activeAgvs.values()) {
        publishConnection(agv, "OFFLINE");
      }
      activeAgvs.clear();

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

    listAgvs: () => Array.from(activeAgvs.values()),
  };
}

function parse(payload: Buffer): Record<string, unknown> {
  try {
    return JSON.parse(payload.toString()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
