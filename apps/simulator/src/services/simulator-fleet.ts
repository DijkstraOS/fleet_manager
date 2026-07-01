import {
  acceptOrder,
  advanceAgv,
  createSimulatedAgv,
  orderRejectionReason,
  type SimulatedAgv,
} from "../simulation";
import type { MapDocument, VdaOrder } from "@agv/core";

export interface CreateAgvCommand {
  serialNumber: string;
  manufacturer: string;
  map: MapDocument;
  startNodeId?: string;
  speedMetersPerSecond?: number;
}

export interface OrderEnvelope {
  manufacturer: string;
  serialNumber: string;
  order: VdaOrder;
}

export interface SimulatorFleetPublisher {
  publishAgv: (agv: SimulatedAgv) => void;
  publishConnection: (agv: SimulatedAgv, connectionState: "ONLINE" | "OFFLINE") => void;
  publishOrderStatus: (data: {
    status: "received" | "completed" | "failed" | "rejected";
    orderId: string;
    serialNumber: string;
    reason?: string;
  }) => void;
}

export interface SimulatorFleetOptions {
  publisher: SimulatorFleetPublisher;
  log?: Pick<Console, "log"> | null;
}

export interface SimulatorFleet {
  createAgv: (command: CreateAgvCommand) => void;
  acceptOrder: (envelope: OrderEnvelope) => void;
  tickMotion: (dtMs: number) => void;
  publishAllAgvs: () => void;
  listAgvs: () => SimulatedAgv[];
  shutdown: () => void;
}

export function createSimulatorFleet(options: SimulatorFleetOptions): SimulatorFleet {
  const activeAgvs = new Map<string, SimulatedAgv>();

  return {
    createAgv: (command) => {
      const agv = createSimulatedAgv(command);
      activeAgvs.set(command.serialNumber, agv);
      options.publisher.publishConnection(agv, "ONLINE");
      options.publisher.publishAgv(agv);
      options.log?.log(`[sim] created ${command.manufacturer}/${command.serialNumber} on ${agv.currentNodeId}`);
    },

    acceptOrder: (envelope) => {
      const current = activeAgvs.get(envelope.serialNumber);
      if (!current) return;

      const rejection = orderRejectionReason(current, envelope.order);
      if (rejection) {
        options.publisher.publishOrderStatus({
          status: "rejected",
          orderId: envelope.order.orderId,
          serialNumber: envelope.serialNumber,
          reason: rejection,
        });
        options.log?.log(`[sim] ${envelope.serialNumber} rejected order ${envelope.order.orderId}: ${rejection}`);
        return;
      }

      const next = acceptOrder(current, envelope.order);
      activeAgvs.set(envelope.serialNumber, next);
      options.publisher.publishOrderStatus({
        status: "received",
        orderId: envelope.order.orderId,
        serialNumber: envelope.serialNumber,
      });
      options.publisher.publishAgv(next);
      options.log?.log(`[sim] ${envelope.serialNumber} received order ${envelope.order.orderId}`);
    },

    tickMotion: (dtMs) => {
      for (const [serialNumber, agv] of activeAgvs) {
        const previousOrderId = agv.currentOrder?.orderId || "";
        const next = advanceAgv(agv, dtMs);
        activeAgvs.set(serialNumber, next);

        if (previousOrderId && !next.currentOrder) {
          options.publisher.publishOrderStatus({
            status: "completed",
            orderId: previousOrderId,
            serialNumber,
          });
          options.log?.log(`[sim] ${serialNumber} completed ${previousOrderId}`);
        }
      }
    },

    publishAllAgvs: () => {
      for (const agv of activeAgvs.values()) {
        options.publisher.publishAgv(agv);
      }
    },

    listAgvs: () => Array.from(activeAgvs.values()),

    shutdown: () => {
      for (const agv of activeAgvs.values()) {
        options.publisher.publishConnection(agv, "OFFLINE");
      }
      activeAgvs.clear();
    },
  };
}
