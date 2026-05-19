import type { MapDocument, OrderDraft } from "@agv/core";

export interface AgvSnapshot {
  serialNumber: string;
  manufacturer: string;
  mapId: string | null;
  state: unknown;
  visualization: unknown;
  lastSeenAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || response.statusText);
  }
  return response.json() as Promise<T>;
}

export function listMaps() {
  return request<Array<{ id: string; name: string }>>("/api/maps");
}

export function getMap(id: string) {
  return request<MapDocument>(`/api/maps/${encodeURIComponent(id)}`);
}

export function saveMap(map: MapDocument) {
  return request<MapDocument>("/api/maps", {
    method: "POST",
    body: JSON.stringify(map),
  });
}

export function exportLif(mapId: string) {
  return request<unknown>(`/api/maps/${encodeURIComponent(mapId)}/export-lif`, { method: "POST" });
}

export function listAgvs() {
  return request<AgvSnapshot[]>("/api/agvs");
}

export function sendOrder(draft: OrderDraft) {
  return request<{ ok: boolean }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}
