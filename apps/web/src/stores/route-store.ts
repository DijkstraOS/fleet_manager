import { findEdge, type MapDocument, type RouteDocument } from "@agv/core";
import { create } from "zustand";

function draftFromRoute(
  route: RouteDocument | null | undefined,
  loadedStatus: string,
): {
  selectedRouteId: string | null;
  draftName: string;
  draftNodeIds: string[];
  status: string;
  draftActive: boolean;
} {
  if (!route) {
    return {
      selectedRouteId: null,
      draftName: "New Route",
      draftNodeIds: [],
      status: "No saved routes for this map.",
      draftActive: false,
    };
  }
  return {
    selectedRouteId: route.id,
    draftName: route.name,
    draftNodeIds: route.nodeIds,
    status: loadedStatus,
    draftActive: true,
  };
}

export interface RouteEditorState {
  routes: RouteDocument[];
  selectedRouteId: string | null;
  draftName: string;
  draftNodeIds: string[];
  status: string;
  draftActive: boolean;
  setRoutes: (routes: RouteDocument[]) => void;
  startNewRoute: () => void;
  selectRoute: (routeId: string) => void;
  closeEditor: () => void;
  setDraftName: (name: string) => void;
  addDraftNode: (map: MapDocument, nodeId: string) => void;
  removeLastDraftNode: () => void;
  reconcileRemovedNode: (nodeId: string) => void;
  reconcileRenamedNode: (previousId: string, nextId: string) => void;
  reconcileDraftToMap: (map: MapDocument) => void;
  clearDraft: () => void;
  upsertRouteLocal: (route: RouteDocument) => void;
  removeRouteLocal: (routeId: string) => void;
  setStatus: (status: string) => void;
}

export const useRouteStore = create<RouteEditorState>((set, get) => ({
  routes: [],
  selectedRouteId: null,
  draftName: "New Route",
  draftNodeIds: [],
  status: "No route selected.",
  draftActive: false,

  setRoutes: (routes) => set((state) => {
    const selected = state.selectedRouteId
      ? routes.find((route) => route.id === state.selectedRouteId)
      : routes[0];
    return {
      routes,
      ...draftFromRoute(selected, `Loaded ${selected?.name}.`),
    };
  }),

  startNewRoute: () => set({
    selectedRouteId: null,
    draftName: "New Route",
    draftNodeIds: [],
    status: "Create a route by clicking nodes in order.",
    draftActive: true,
  }),

  selectRoute: (routeId) => {
    const route = get().routes.find((item) => item.id === routeId);
    if (!route) return;
    set(draftFromRoute(route, `Editing ${route.name}.`));
  },

  closeEditor: () => set({
    selectedRouteId: null,
    draftName: "New Route",
    draftNodeIds: [],
    status: "No route selected.",
    draftActive: false,
  }),

  setDraftName: (draftName) => set({ draftName }),

  addDraftNode: (map, nodeId) => set((state) => {
    const last = state.draftNodeIds[state.draftNodeIds.length - 1];
    if (!last) return { draftNodeIds: [nodeId], status: "Route started." };
    if (last === nodeId) return {};
    if (!findEdge(map, last, nodeId)) {
      return { status: `No directed edge from ${last} to ${nodeId}.` };
    }
    return {
      draftNodeIds: [...state.draftNodeIds, nodeId],
      status: "Route updated.",
    };
  }),

  removeLastDraftNode: () => set((state) => ({
    draftNodeIds: state.draftNodeIds.slice(0, -1),
    status: "Removed the last route node.",
  })),

  // The draft references map node ids; when the map edit slice deletes or renames
  // a node it calls these so the draft never carries a dangling id (which would
  // block Save/Send Route with route.node.missing). No-op when the id isn't drafted.
  reconcileRemovedNode: (nodeId) => set((state) => {
    if (!state.draftNodeIds.includes(nodeId)) return {};
    return { draftNodeIds: state.draftNodeIds.filter((id) => id !== nodeId) };
  }),

  reconcileRenamedNode: (previousId, nextId) => set((state) => {
    if (previousId === nextId || !state.draftNodeIds.includes(previousId)) return {};
    return { draftNodeIds: state.draftNodeIds.map((id) => (id === previousId ? nextId : id)) };
  }),

  // Wholesale map swaps (import, load, save-roundtrip) replace the node set; drop any
  // draft id the new map lacks. A rename across a full swap reads as a drop, not a
  // remap — there's no old->new correspondence to follow. No-op when nothing is pruned
  // (e.g. save returns the same nodes), so the in-progress draft survives a Save Map.
  reconcileDraftToMap: (map) => set((state) => {
    const present = new Set(map.nodes.map((node) => node.id));
    const filtered = state.draftNodeIds.filter((id) => present.has(id));
    if (filtered.length === state.draftNodeIds.length) return {};
    return { draftNodeIds: filtered };
  }),

  clearDraft: () => set({
    draftNodeIds: [],
    status: "Route cleared.",
  }),

  upsertRouteLocal: (route) => set((state) => ({
    routes: [
      ...state.routes.filter((item) => item.id !== route.id),
      route,
    ].sort((left, right) => left.name.localeCompare(right.name)),
    ...draftFromRoute(route, `Saved ${route.name}.`),
  })),

  removeRouteLocal: (routeId) => set((state) => {
    const routes = state.routes.filter((route) => route.id !== routeId);
    const selected = routes[0];
    return {
      routes,
      ...draftFromRoute(selected, `Editing ${selected?.name}.`),
    };
  }),

  setStatus: (status) => set({ status }),
}));
