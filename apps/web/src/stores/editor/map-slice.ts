import { createDemoMap, slugify, type MapDocument, type MapOp } from "@agv/core";
import type { StateCreator } from "zustand";
import { stampMap } from "./stamp";
import type { EditorState } from "./types";

export interface MapSlice {
  map: MapDocument;
  updateMap: (...ops: Array<MapOp | false | null | undefined>) => void;
  setMapDocument: (map: MapDocument, status?: string, options?: { preserveBackground?: boolean }) => void;
  renameMap: (name: string) => void;
}

export const createMapSlice: StateCreator<EditorState, [], [], MapSlice> = (set, get) => ({
  map: createDemoMap(),

  // Map-only update: apply ops and stamp `updatedAt`. Actions that also change
  // selection/status fold `stampMap` into their own atomic `set` instead.
  updateMap: (...ops) => set((state) => ({ map: stampMap(state.map, ...ops) })),

  setMapDocument: (map, status, options) => set((state) => ({
    map,
    backgroundImage: options?.preserveBackground ? state.backgroundImage : null,
    selection: null,
    edgeStartNodeId: null,
    routeNodeIds: [],
    dragNodeId: null,
    viewport: null,
    ...(status !== undefined ? { status } : {}),
  })),

  renameMap: (name) => get().updateMap((map) => ({
    ...map,
    name,
    id: slugify(name) || map.id,
  })),
});
