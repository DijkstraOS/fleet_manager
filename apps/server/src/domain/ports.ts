import type { LifDocument, MapDocument, OrderDraft, RouteDocument, VdaOrder, VdaState, VdaVisualization } from "@agv/core";

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

export interface RouteRepository {
  load: () => Promise<void>;
  list: (mapId?: string) => RouteDocument[];
  get: (id: string) => RouteDocument | undefined;
  upsert: (route: RouteDocument) => Promise<RouteDocument>;
  delete: (id: string) => Promise<boolean>;
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
  routeId?: string;
  routeName?: string;
}

export type OrderRequest = OrderDraft;

export interface MapHandlers {
  listMaps: () => MapSummary[];
  getMap: (id: string) => MapDocument | undefined;
  saveMap: (map: MapDocument) => Promise<MapDocument>;
  exportLif: (id: string) => LifDocument | undefined;
}

export interface RouteHandlers {
  listRoutes: (mapId?: string) => RouteDocument[];
  saveRoute: (route: RouteDocument) => Promise<RouteDocument>;
  deleteRoute: (id: string) => Promise<boolean>;
}

export interface FleetHandlers {
  listAgvs: () => KnownAgv[];
}

export interface OrderHandlers {
  sendOrder: (draft: OrderDraft) => OrderResult;
}
