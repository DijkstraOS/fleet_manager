import type {
  Headerless,
  Order,
  State,
  Visualization,
} from "vda-5050-lib";

export type ConnectionStatus = "ONLINE" | "OFFLINE" | "CONNECTIONBROKEN";
export type OperatingMode = "AUTOMATIC" | "SEMIAUTOMATIC" | "MANUAL" | "SERVICE" | "TEACHIN";

export const VDA_5050_VERSION = "2.1.0";

export interface OrderDraft {
  mapId: string;
  agvSerialNumber: string;
  routeNodeIds: string[];
  routeId?: string;
  routeName?: string;
  loop?: boolean;
}

export type VdaOrder = Headerless<Order>;
export type VdaPublishedOrder = Order;
export type VdaOrderNode = Order["nodes"][number];
export type VdaOrderEdge = Order["edges"][number];
export type VdaState = State;
export type VdaStateDraft = Headerless<State>;
export type VdaVisualization = Visualization;
export type VdaVisualizationDraft = Headerless<Visualization>;
