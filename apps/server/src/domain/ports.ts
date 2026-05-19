import type { LifDocument, MapDocument, OrderDraft, VdaOrder, VdaState, VdaVisualization } from "@agv/core";

export interface MapSummary {
  id: string;
  name: string;
  version: string;
  updatedAt: string;
  nodes: number;
  edges: number;
}

export interface MapRepository {
  load: () => Promise<void>;
  list: () => MapSummary[];
  get: (id: string) => MapDocument | undefined;
  upsert: (map: MapDocument) => Promise<MapDocument>;
  close?: () => Promise<void>;
}

export interface KnownAgv {
  serialNumber: string;
  manufacturer: string;
  mapId: string | null;
  connectionState: "ONLINE" | "OFFLINE" | null;
  state: VdaState | null;
  visualization: VdaVisualization | null;
  lastSeenAt: string;
}

export interface FleetGateway {
  listAgvs: () => KnownAgv[];
  getAgv: (serialNumber: string) => KnownAgv | undefined;
  publishOrder: (agv: KnownAgv, order: VdaOrder) => void;
  start: () => Promise<void>;
  close: () => Promise<void>;
}

export interface RealtimeMessage {
  type: string;
  [key: string]: unknown;
}

export interface RealtimePublisher {
  broadcast: (message: RealtimeMessage) => void;
  close: () => Promise<void>;
}

export interface OrderResult {
  status: "sent";
  orderId: string;
  serialNumber: string;
  timestamp: string;
  order: VdaOrder;
}

export type OrderRequest = OrderDraft;

export interface MapHandlers {
  listMaps: () => MapSummary[];
  getMap: (id: string) => MapDocument | undefined;
  saveMap: (map: MapDocument) => Promise<MapDocument>;
  exportLif: (id: string) => LifDocument | undefined;
}

export interface FleetHandlers {
  listAgvs: () => KnownAgv[];
}

export interface OrderHandlers {
  sendOrder: (draft: OrderDraft) => OrderResult;
}
