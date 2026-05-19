import type { MapDocument } from "@agv/core";

export interface ServerMapSummary {
  id: string;
  name: string;
}

export interface MapClient {
  listMaps: () => Promise<ServerMapSummary[]>;
  getMap: (id: string) => Promise<MapDocument>;
}

export function createMapClient(serverUrl: string): MapClient {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    listMaps: () => request<ServerMapSummary[]>(`${baseUrl}/api/maps`),
    getMap: (id) => request<MapDocument>(`${baseUrl}/api/maps/${encodeURIComponent(id)}`),
  };
}

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}
