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
  /** Whether a route is being edited — a saved route is selected or a new draft was started.
   *  Drives the right-zone editor card's open state; false collapses it. */
  draftActive: boolean;
  setRoutes: (routes: RouteDocument[]) => void;
  startNewRoute: () => void;
  selectRoute: (routeId: string) => void;
  /** Deselect the active route and collapse the editor card (the close affordance). */
  closeEditor: () => void;
  setDraftName: (name: string) => void;
  setDraftNodeIds: (nodeIds: string[]) => void;
  addDraftNode: (map: MapDocument, nodeId: string) => void;
  removeLastDraftNode: () => void;
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
  setDraftNodeIds: (draftNodeIds) => set({ draftNodeIds }),

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
