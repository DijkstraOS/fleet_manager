import {
  appendEdge,
  appendNode,
  clampPointToFloor,
  findEdge,
  findNode,
  moveNode,
  nextEdgeId,
  nextNodeId,
  removeEdge,
  removeNode,
  replaceEdge,
  replaceEdgeWith,
  replaceNode,
  splitEdge,
  syncTrajectoryEndpoints,
  type MapEdge,
  type MapNode,
} from "@agv/core";
import type { StateCreator } from "zustand";
import { selectedEdge, selectedNode } from "./guards";
import { stampMap } from "./stamp";
import type { EditorState } from "./types";

export interface MapEditSlice {
  dragNodeId: string | null;
  addNodeAt: (x: number, y: number) => void;
  handleEdgeNode: (nodeId: string) => void;
  addReverseEdgeForSelection: () => void;
  bifurcateSelectedEdge: (options?: { includeReverse?: boolean }) => void;
  beginDragNode: (nodeId: string) => void;
  dragNodeTo: (x: number, y: number) => void;
  endDragNode: () => void;
  deleteSelection: () => void;
  updateNode: (node: MapNode) => void;
  updateEdge: (edge: MapEdge) => void;
}

export const createMapEditSlice: StateCreator<EditorState, [], [], MapEditSlice> = (set, get) => ({
  dragNodeId: null,

  addNodeAt: (x, y) => set((state) => {
    const id = nextNodeId(state.map);
    const point = clampPointToFloor(x, y, state.map.canvas);
    return {
      selection: { type: "node", id },
      map: stampMap(state.map, appendNode({ id, label: "", x: point.x, y: point.y })),
    };
  }),

  handleEdgeNode: (nodeId) => set((state) => {
    const { map, edgeStartNodeId } = state;
    if (!edgeStartNodeId) {
      return { edgeStartNodeId: nodeId, selection: { type: "node", id: nodeId } };
    }
    if (edgeStartNodeId === nodeId || findEdge(map, edgeStartNodeId, nodeId)) {
      return { edgeStartNodeId: null };
    }
    const id = nextEdgeId(map, edgeStartNodeId, nodeId);
    return {
      edgeStartNodeId: null,
      selection: { type: "edge", id },
      map: stampMap(map, appendEdge({
        id,
        label: `${edgeStartNodeId} -> ${nodeId}`,
        from: edgeStartNodeId,
        to: nodeId,
        orientationType: "TANGENTIAL",
        rotationAllowed: true,
        trajectory: null,
      })),
    };
  }),

  addReverseEdgeForSelection: () => set((state) => {
    const edge = selectedEdge(state);
    if (!edge) return {};
    const reverse = findEdge(state.map, edge.to, edge.from);
    if (reverse) {
      return {
        selection: { type: "edge", id: reverse.id },
        status: `Reverse edge ${reverse.id} already exists.`,
      };
    }
    const id = nextEdgeId(state.map, edge.to, edge.from);
    return {
      selection: { type: "edge", id },
      status: `Added reverse edge ${id}.`,
      map: stampMap(state.map, appendEdge({
        id,
        label: `${edge.to} -> ${edge.from}`,
        from: edge.to,
        to: edge.from,
        ...(edge.maxSpeed !== undefined ? { maxSpeed: edge.maxSpeed } : {}),
        ...(edge.orientation !== undefined ? { orientation: edge.orientation } : {}),
        orientationType: edge.orientationType,
        rotationAllowed: edge.rotationAllowed,
        trajectory: null,
      })),
    };
  }),

  bifurcateSelectedEdge: (options) => set((state) => {
    const edge = selectedEdge(state);
    if (!edge) return {};
    const from = findNode(state.map, edge.from);
    const to = findNode(state.map, edge.to);
    if (!from || !to) return {};
    const includeReverse = options?.includeReverse === true;
    const reverse = includeReverse ? findEdge(state.map, edge.to, edge.from) : undefined;
    const baseEdges = state.map.edges.filter((item) =>
      item.id !== edge.id && item.id !== reverse?.id
    );
    const split = splitEdge(edge, from, to, state.map, { availableEdges: baseEdges });
    if (!split) {
      return { status: "Reset unsupported imported trajectory before bifurcating this edge." };
    }
    const replacementEdges = [...split.edges];
    if (reverse) {
      const reverseFrom = findNode(state.map, reverse.from);
      const reverseTo = findNode(state.map, reverse.to);
      if (!reverseFrom || !reverseTo) return {};
      const reverseSplit = splitEdge(reverse, reverseFrom, reverseTo, state.map, {
        node: split.node,
        availableEdges: [...baseEdges, ...replacementEdges],
      });
      if (!reverseSplit) {
        return { status: "Reset unsupported reverse edge trajectory before bifurcating both directions." };
      }
      replacementEdges.push(...reverseSplit.edges);
    }
    return {
      selection: { type: "node", id: split.node.id },
      status: `Bifurcated edge ${edge.id}.`,
      map: stampMap(
        state.map,
        appendNode(split.node),
        replaceEdgeWith(edge.id, replacementEdges),
        reverse ? removeEdge(reverse.id) : undefined,
      ),
    };
  }),

  beginDragNode: (nodeId) => set({ dragNodeId: nodeId }),

  dragNodeTo: (x, y) => {
    const { dragNodeId, tool, map } = get();
    if (!dragNodeId || tool !== "select") return;
    const point = clampPointToFloor(x, y, map.canvas);
    get().updateMap(moveNode(dragNodeId, point.x, point.y));
  },

  endDragNode: () => set({ dragNodeId: null }),

  deleteSelection: () => set((state) => {
    const { selection } = state;
    if (!selection) return {};
    if (selection.type === "node") {
      return {
        selection: null,
        map: stampMap(state.map, removeNode(selection.id)),
      };
    }
    return {
      selection: null,
      map: stampMap(state.map, removeEdge(selection.id)),
    };
  }),

  updateNode: (next) => set((state) => {
    const previous = selectedNode(state);
    if (!previous) return {};
    return {
      selection: { type: "node", id: next.id },
      map: stampMap(state.map, replaceNode(previous.id, next)),
    };
  }),

  updateEdge: (next) => set((state) => {
    const current = selectedEdge(state);
    if (!current) return {};
    const synced = syncTrajectoryEndpoints(next, findNode(state.map, next.from), findNode(state.map, next.to));
    return {
      selection: { type: "edge", id: synced.id },
      map: stampMap(state.map, replaceEdge(current.id, synced)),
    };
  }),
});
