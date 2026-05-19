import { create } from "zustand";
import {
  createDemoMap,
  findEdge,
  nextEdgeId,
  nextNodeId,
  slugify,
  type MapDocument,
  type MapEdge,
  type MapNode,
} from "@agv/core";

export type Tool = "select" | "node" | "edge" | "route";
export type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | null;

export interface EditorState {
  map: MapDocument;
  tool: Tool;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  dragNodeId: string | null;
  status: string;
  setStatus: (status: string) => void;
  setMapDocument: (map: MapDocument, status?: string) => void;
  updateMap: (updater: (map: MapDocument) => MapDocument) => void;
  renameMap: (name: string) => void;
  setTool: (tool: Tool) => void;
  clearSelection: () => void;
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
  addNodeAt: (x: number, y: number) => void;
  handleEdgeNode: (nodeId: string) => void;
  addRouteNode: (nodeId: string) => void;
  beginDragNode: (nodeId: string) => void;
  dragNodeTo: (x: number, y: number) => void;
  endDragNode: () => void;
  deleteSelection: () => void;
  updateNode: (node: MapNode) => void;
  updateEdge: (edge: MapEdge) => void;
  clearRoute: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  map: createDemoMap(),
  tool: "select",
  selection: null,
  edgeStartNodeId: null,
  routeNodeIds: [],
  dragNodeId: null,
  status: "Loading map...",

  setStatus: (status) => set({ status }),

  setMapDocument: (map, status) => set({
    map,
    selection: null,
    edgeStartNodeId: null,
    routeNodeIds: [],
    dragNodeId: null,
    ...(status !== undefined ? { status } : {}),
  }),

  updateMap: (updater) => set((state) => ({
    map: {
      ...updater(state.map),
      updatedAt: new Date().toISOString(),
    },
  })),

  renameMap: (name) => set((state) => ({
    map: {
      ...state.map,
      name,
      id: slugify(name) || state.map.id,
      updatedAt: new Date().toISOString(),
    },
  })),

  setTool: (tool) => set({ tool, edgeStartNodeId: null }),
  clearSelection: () => set({ selection: null, edgeStartNodeId: null }),
  selectNode: (nodeId) => set({ selection: { type: "node", id: nodeId } }),
  selectEdge: (edgeId) => set({ selection: { type: "edge", id: edgeId } }),

  addNodeAt: (x, y) => set((state) => {
    const id = nextNodeId(state.map);
    return {
      map: {
        ...state.map,
        nodes: [...state.map.nodes, { id, label: id, x, y }],
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  handleEdgeNode: (nodeId) => set((state) => {
    if (!state.edgeStartNodeId) {
      return {
        edgeStartNodeId: nodeId,
        selection: { type: "node", id: nodeId },
      };
    }

    const edgeStartNodeId = state.edgeStartNodeId;
    if (edgeStartNodeId === nodeId || findEdge(state.map, edgeStartNodeId, nodeId)) {
      return { edgeStartNodeId: null };
    }

    return {
      edgeStartNodeId: null,
      map: {
        ...state.map,
        edges: [
          ...state.map.edges,
          {
            id: nextEdgeId(state.map, edgeStartNodeId, nodeId),
            label: `${edgeStartNodeId} -> ${nodeId}`,
            from: edgeStartNodeId,
            to: nodeId,
            orientationType: "TANGENTIAL",
            rotationAllowed: true,
            trajectory: null,
          },
        ],
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  addRouteNode: (nodeId) => set((state) => {
    const last = state.routeNodeIds[state.routeNodeIds.length - 1];
    if (!last) return { routeNodeIds: [nodeId] };
    if (last === nodeId) return {};
    if (!findEdge(state.map, last, nodeId)) {
      return { status: `No directed edge from ${last} to ${nodeId}.` };
    }
    return { routeNodeIds: [...state.routeNodeIds, nodeId], status: "Route updated." };
  }),

  beginDragNode: (nodeId) => set({ dragNodeId: nodeId }),

  dragNodeTo: (x, y) => set((state) => {
    if (!state.dragNodeId || state.tool !== "select") return {};
    return {
      map: {
        ...state.map,
        nodes: state.map.nodes.map((node) =>
          node.id === state.dragNodeId ? { ...node, x, y } : node
        ),
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  endDragNode: () => set({ dragNodeId: null }),

  deleteSelection: () => set((state) => {
    if (!state.selection) return {};
    if (state.selection.type === "node") {
      const deletedNodeId = state.selection.id;
      return {
        selection: null,
        routeNodeIds: state.routeNodeIds.filter((nodeId) => nodeId !== deletedNodeId),
        map: {
          ...state.map,
          nodes: state.map.nodes.filter((node) => node.id !== deletedNodeId),
          edges: state.map.edges.filter((edge) => edge.from !== deletedNodeId && edge.to !== deletedNodeId),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    return {
      selection: null,
      map: {
        ...state.map,
        edges: state.map.edges.filter((edge) => edge.id !== state.selection?.id),
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  updateNode: (next) => set((state) => {
    if (state.selection?.type !== "node") return {};
    const previousId = state.selection.id;
    return {
      selection: { type: "node", id: next.id },
      routeNodeIds: state.routeNodeIds.map((nodeId) => nodeId === previousId ? next.id : nodeId),
      map: {
        ...state.map,
        nodes: state.map.nodes.map((node) => node.id === previousId ? next : node),
        edges: state.map.edges.map((edge) => ({
          ...edge,
          from: edge.from === previousId ? next.id : edge.from,
          to: edge.to === previousId ? next.id : edge.to,
        })),
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  updateEdge: (next) => set((state) => {
    if (state.selection?.type !== "edge") return {};
    return {
      selection: { type: "edge", id: next.id },
      map: {
        ...state.map,
        edges: state.map.edges.map((edge) => edge.id === state.selection?.id ? next : edge),
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  clearRoute: () => set({ routeNodeIds: [] }),
}));
