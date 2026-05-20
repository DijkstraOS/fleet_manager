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
      const serialNumber = String(message.serialNumber);
      set((state) => ({
        agvs: {
          ...state.agvs,
          [serialNumber]: {
            serialNumber,
            manufacturer: String(message.manufacturer || ""),
            state: message.state as VdaState,
            visualization: state.agvs[serialNumber]?.visualization || null,
          },
        },
        selectedAgvSerial: state.selectedAgvSerial || serialNumber,
      }));
    }

    if (message.type === "agv_visualization") {
      const serialNumber = String(message.serialNumber);
      set((state) => ({
        agvs: {
          ...state.agvs,
          [serialNumber]: {
            serialNumber,
            manufacturer: String(message.manufacturer || ""),
            state: state.agvs[serialNumber]?.state || null,
            visualization: message.visualization as VdaVisualization,
          },
        },
        selectedAgvSerial: state.selectedAgvSerial || serialNumber,
      }));
    }

    if (message.type === "order_status") {
      const serialNumber = String(message.serialNumber || "AGV");
      const orderId = String(message.orderId || "");
      const status = String(message.status || "");
      const routeName = typeof message.routeName === "string" ? message.routeName : undefined;
      const routeId = typeof message.routeId === "string" ? message.routeId : undefined;
      const timestamp = typeof message.timestamp === "string" ? message.timestamp : new Date().toISOString();
      const tracked: TrackedOrderStatus = {
        serialNumber,
        orderId,
        status,
        timestamp,
        ...(routeId ? { routeId } : {}),
        ...(routeName ? { routeName } : {}),
      };
      set((state) => ({
        orderStatuses: {
          ...state.orderStatuses,
          [serialNumber]: tracked,
        },
        orderStatus: routeName
          ? `${serialNumber} ${routeName}: ${status}`
          : `${serialNumber} order ${orderId}: ${status}`,
      }));
    }
  },
}));
