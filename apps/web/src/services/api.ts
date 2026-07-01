import type { MapDocument, OrderDraft, RouteDocument } from "@agv/core";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
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

export function listRoutes(mapId?: string) {
  const query = mapId ? `?mapId=${encodeURIComponent(mapId)}` : "";
  return request<RouteDocument[]>(`/api/routes${query}`);
}

export function saveRoute(route: RouteDocument) {
  return request<RouteDocument>("/api/routes", {
    method: "POST",
    body: JSON.stringify(route),
  });
}

export function deleteRoute(routeId: string) {
  return request<{ ok: boolean }>(`/api/routes/${encodeURIComponent(routeId)}`, {
    method: "DELETE",
  });
}

export function sendOrder(draft: OrderDraft) {
  return request<{ ok: boolean }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function stopLoop(serialNumber: string) {
  return request<{ ok: boolean; stopped: boolean }>(`/api/orders/loops/${encodeURIComponent(serialNumber)}`, {
    method: "DELETE",
  });
}
