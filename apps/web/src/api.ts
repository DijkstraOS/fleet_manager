import type { MapDocument, OrderDraft } from "@agv/core";

export interface AgvSnapshot {
  serialNumber: string;
  manufacturer: string;
  mapId: string | null;
  state: unknown;
  visualization: unknown;
  lastSeenAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listMaps() {
  return request<Array<{ id: string; name: string; nodes: number; edges: number; updatedAt: string }>>("/api/maps");
}

export function getMap(id: string) {
  return request<MapDocument>(`/api/maps/${id}`);
}

export function saveMap(map: MapDocument) {
  return request<MapDocument>("/api/maps", {
    method: "POST",
    body: JSON.stringify(map),
  });
}

export function exportLif(mapId: string) {
  return request<unknown>(`/api/maps/${mapId}/export-lif`, { method: "POST" });
}

export function listAgvs() {
  return request<AgvSnapshot[]>("/api/agvs");
}

export function startSimulator(data: {
  mapId: string;
  startNodeId: string;
  serialNumber?: string;
  speedMetersPerSecond?: number;
}) {
  return request<{ ok: boolean; serialNumber: string }>("/api/sim/agvs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function sendOrder(draft: OrderDraft) {
  return request<{ ok: boolean; order: unknown }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}
