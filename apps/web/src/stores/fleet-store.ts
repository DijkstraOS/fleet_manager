import { create } from "zustand";
import type { VdaState, VdaVisualization } from "@agv/core";

export interface RealtimeAgv {
  serialNumber: string;
  manufacturer: string;
  state: VdaState | null;
  visualization: VdaVisualization | null;
}

export interface FleetState {
  agvs: Record<string, RealtimeAgv>;
  selectedAgvSerial: string | null;
  realtimeStatus: string;
  orderStatus: string;
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
      set({
        orderStatus: `${message.serialNumber || "AGV"} order ${message.orderId || ""}: ${message.status}`,
      });
    }
  },
}));
