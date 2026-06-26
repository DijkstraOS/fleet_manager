import { findEdge } from "@agv/core";
import type { StateCreator } from "zustand";
import type { CanvasBounds } from "../../lib/geometry";
import type { Selection, Tool, WorkspaceMode } from "../../types";
import type { EditorState } from "./types";

export interface WorkspaceSlice {
  workspaceMode: WorkspaceMode;
  tool: Tool;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  viewport: CanvasBounds | null;
  status: string;
  setStatus: (status: string) => void;
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void;
  setTool: (tool: Tool) => void;
  setViewport: (viewport: CanvasBounds | null) => void;
  clearSelection: () => void;
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
  addRouteNode: (nodeId: string) => void;
  clearRoute: () => void;
}

export const createWorkspaceSlice: StateCreator<EditorState, [], [], WorkspaceSlice> = (set) => ({
  workspaceMode: "map",
  tool: "select",
  selection: null,
  edgeStartNodeId: null,
  routeNodeIds: [],
  viewport: null,
  status: "Loading map...",

  setStatus: (status) => set({ status }),

  setWorkspaceMode: (workspaceMode) => set({
    workspaceMode,
    tool: "select",
    selection: null,
    edgeStartNodeId: null,
    dragNodeId: null,
  }),

  setTool: (tool) => set({
    tool,
    selection: null,
    edgeStartNodeId: null,
    dragNodeId: null,
  }),

  setViewport: (viewport) => set({ viewport }),

  clearSelection: () => set({ selection: null, edgeStartNodeId: null }),
  selectNode: (nodeId) => set({ selection: { type: "node", id: nodeId } }),
  selectEdge: (edgeId) => set({ selection: { type: "edge", id: edgeId } }),

  addRouteNode: (nodeId) => set((state) => {
    const last = state.routeNodeIds[state.routeNodeIds.length - 1];
    if (!last) return { routeNodeIds: [nodeId] };
    if (last === nodeId) return {};
    if (!findEdge(state.map, last, nodeId)) {
      return { status: `No directed edge from ${last} to ${nodeId}.` };
    }
    return { routeNodeIds: [...state.routeNodeIds, nodeId], status: "Route updated." };
  }),

  clearRoute: () => set({ routeNodeIds: [] }),
});
