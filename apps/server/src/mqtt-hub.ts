import { createRequire } from "node:module";
import net from "node:net";
import mqtt, { type MqttClient } from "mqtt";
import type { createBroker as createBrokerType } from "aedes";
import type { MapDocument, VdaOrder, VdaState, VdaVisualization } from "@agv/core";

const require = createRequire(import.meta.url);
const createBroker = require("aedes") as typeof createBrokerType;
type AedesInstance = ReturnType<typeof createBrokerType>;

export interface KnownAgv {
  serialNumber: string;
  manufacturer: string;
  mapId: string | null;
  state: VdaState | null;
  visualization: VdaVisualization | null;
  lastSeenAt: string;
}

export class MqttHub {
  readonly interfaceName: string;
  readonly brokerUrl: string;
  private broker: AedesInstance;
  private brokerServer: net.Server;
  private client: MqttClient | null = null;
  private agvs = new Map<string, KnownAgv>();
  private started = false;

  constructor(private options: {
    port: number;
    interfaceName: string;
    onAgvState: (agv: KnownAgv) => void;
    onAgvVisualization: (agv: KnownAgv) => void;
    onOrderStatus: (data: Record<string, unknown>) => void;
  }) {
    this.interfaceName = options.interfaceName;
    this.brokerUrl = `mqtt://127.0.0.1:${options.port}`;
    this.broker = createBroker();
    this.brokerServer = net.createServer(this.broker.handle);
  }

  async start() {
    await new Promise<void>((resolve, reject) => {
      this.brokerServer.once("error", reject);
      this.brokerServer.listen(this.options.port, () => {
        this.brokerServer.off("error", reject);
        this.started = true;
        resolve();
      });
    });

    this.client = mqtt.connect(this.brokerUrl, { clientId: "agv-server-master" });
    await new Promise<void>((resolve, reject) => {
      if (!this.client) return reject(new Error("MQTT client not initialized."));
      this.client.once("connect", () => resolve());
      this.client.once("error", reject);
    });

    this.client.subscribe(`${this.interfaceName}/v2/+/+/state`);
    this.client.subscribe(`${this.interfaceName}/v2/+/+/visualization`);
    this.client.subscribe(`${this.interfaceName}/v2/+/+/connection`);
    this.client.subscribe(`${this.interfaceName}/server/order-status`);
    this.client.on("message", (topic, payload) => this.handleMessage(topic, payload));
  }

  async close() {
    const client = this.client;
    this.client = null;
    if (client) {
      await new Promise<void>((resolve, reject) => {
        client.end(true, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    if (this.started) {
      await new Promise<void>((resolve, reject) => {
        this.brokerServer.close((error) => {
          if (error) reject(error);
          else {
            this.started = false;
            resolve();
          }
        });
      });
    }
    await new Promise<void>((resolve) => this.broker.close(resolve));
  }

  listAgvs() {
    return Array.from(this.agvs.values());
  }

  getAgv(serialNumber: string) {
    return this.agvs.get(serialNumber);
  }

  publishOrder(agv: KnownAgv, order: VdaOrder) {
    this.publish(`${this.interfaceName}/v2/${agv.manufacturer}/${agv.serialNumber}/order`, order);
  }

  requestSimulatedAgv(data: {
    serialNumber: string;
    manufacturer: string;
    map: MapDocument;
    startNodeId: string;
    speedMetersPerSecond?: number;
  }) {
    this.publish(`${this.interfaceName}/sim/create`, data, { retain: true });
  }

  private handleMessage(topic: string, payload: Buffer) {
    const parts = topic.split("/");
    if (topic === `${this.interfaceName}/server/order-status`) {
      this.options.onOrderStatus(this.parse(payload));
      return;
    }
    if (parts.length < 5 || parts[0] !== this.interfaceName || parts[1] !== "v2") return;

    const manufacturer = parts[2];
    const serialNumber = parts[3];
    const kind = parts[4];
    if (!manufacturer || !serialNumber || !kind) return;

    const existing = this.agvs.get(serialNumber);
    const agv: KnownAgv = existing || {
      serialNumber,
      manufacturer,
      mapId: null,
      state: null,
      visualization: null,
      lastSeenAt: new Date().toISOString(),
    };
    agv.lastSeenAt = new Date().toISOString();

    if (kind === "state") {
      const state = this.parse(payload) as unknown as VdaState;
      agv.state = state;
      agv.mapId = state.agvPosition.mapId || agv.mapId;
      this.agvs.set(serialNumber, agv);
      this.options.onAgvState(agv);
    }

    if (kind === "visualization") {
      const visualization = this.parse(payload) as unknown as VdaVisualization;
      agv.visualization = visualization;
      agv.mapId = visualization.agvPosition.mapId || agv.mapId;
      this.agvs.set(serialNumber, agv);
      this.options.onAgvVisualization(agv);
    }
  }

  private publish(topic: string, value: unknown, options: { retain?: boolean } = {}) {
    if (!this.client) throw new Error("MQTT client is not connected.");
    this.client.publish(topic, JSON.stringify(value), { qos: 0, ...options });
  }

  private parse(payload: Buffer): Record<string, unknown> {
    try {
      return JSON.parse(payload.toString()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
