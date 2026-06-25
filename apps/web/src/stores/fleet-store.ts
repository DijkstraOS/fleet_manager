import { create } from "zustand";
import type { VdaState, VdaVisualization } from "@agv/core";

export interface RealtimeAgv {
  serialNumber: string;
  manufacturer: string;
  state: VdaState | null;
  visualization: VdaVisualization | null;
}

export interface TrackedOrderStatus {
  serialNumber: string;
  orderId: string;
  status: string;
  timestamp: string;
  routeId?: string;
  routeName?: string;
  loop?: boolean;
  loopIteration?: number;
  reason?: string;
}

export interface FleetState {
  agvs: Record<string, RealtimeAgv>;
  selectedAgvSerial: string | null;
  realtimeStatus: string;
  orderStatus: string;
  orderStatuses: Record<string, TrackedOrderStatus>;
  selectAgv: (serialNumber: string) => void;
  setRealtimeStatus: (status: string) => void;
  setOrderStatus: (status: string) => void;
  handleRealtimeMessage: (message: Record<string, unknown>) => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  agvs: {},
  selectedAgvSerial: null,
  realtimeStatus: "Connecting realtime...",
  orderStatus: "",
  orderStatuses: {},

  selectAgv: (selectedAgvSerial) => set({ selectedAgvSerial }),
  setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),
  setOrderStatus: (orderStatus) => set({ orderStatus }),

  handleRealtimeMessage: (message) => {
    if (message.type === "agv_state") {
      upsertAgv(set, message, { state: message.state as VdaState });
    }

    if (message.type === "agv_visualization") {
      upsertAgv(set, message, { visualization: message.visualization as VdaVisualization });
    }

    if (message.type === "order_status") {
      const serialNumber = String(message.serialNumber || "AGV");
      const orderId = String(message.orderId || "");
      const status = String(message.status || "");
      const routeName = typeof message.routeName === "string" ? message.routeName : undefined;
      const routeId = typeof message.routeId === "string" ? message.routeId : undefined;
      const loop = message.loop === true;
      const loopIteration = typeof message.loopIteration === "number" ? message.loopIteration : undefined;
      const timestamp = typeof message.timestamp === "string" ? message.timestamp : new Date().toISOString();
      const reason = typeof message.reason === "string" ? message.reason : undefined;
      const tracked: TrackedOrderStatus = {
        serialNumber,
        orderId,
        status,
        timestamp,
        ...(routeId ? { routeId } : {}),
        ...(routeName ? { routeName } : {}),
        ...(loop ? { loop: true } : {}),
        ...(loopIteration !== undefined ? { loopIteration } : {}),
        ...(reason ? { reason } : {}),
      };
      const label = routeName ? `${serialNumber} ${routeName}` : `${serialNumber} order ${orderId}`;
      const reasonSuffix = reason ? ` — ${reason}` : "";
      set((state) => ({
        orderStatuses: {
          ...state.orderStatuses,
          [serialNumber]: tracked,
        },
        orderStatus: `${label}: ${formatStatus(status, loop, loopIteration)}${reasonSuffix}`,
      }));
    }
  },
}));

type SetFleetState = (
  updater: (state: FleetState) => Partial<FleetState>
) => void;

function upsertAgv(
  set: SetFleetState,
  message: Record<string, unknown>,
  patch: Pick<RealtimeAgv, "state"> | Pick<RealtimeAgv, "visualization">
) {
  const serialNumber = String(message.serialNumber);
  set((state) => ({
    agvs: {
      ...state.agvs,
      [serialNumber]: {
        serialNumber,
        manufacturer: String(message.manufacturer || ""),
        state: state.agvs[serialNumber]?.state || null,
        visualization: state.agvs[serialNumber]?.visualization || null,
        ...patch,
      },
    },
    selectedAgvSerial: state.selectedAgvSerial || serialNumber,
  }));
}

function formatStatus(status: string, loop: boolean, loopIteration?: number) {
  if (!loop) return status;
  return loopIteration ? `${status} · loop ${loopIteration}` : status;
}
