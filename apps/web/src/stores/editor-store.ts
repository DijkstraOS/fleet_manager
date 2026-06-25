import { create } from "zustand";
import {
  copyBifurcatedEdgeProperties,
  createDemoMap,
  edgesShareQuadraticHandle,
  findEdge,
  findNode,
  isSupportedQuadraticBezier,
  nextEdgeId,
  nextNodeId,
  resetEdgeToQuadraticBezier,
  resetReverseEdgeToSelectedCurvePath,
  slugify,
  setQuadraticBezierHandle,
  splitEdge,
  syncMapEdgeTrajectoryEndpoints,
  syncTrajectoryEndpoints,
  type MapDocument,
  type MapEdge,
  type MapNode,
} from "@agv/core";
import { fitRectToBounds, getNodeBounds, type CanvasBounds } from "../lib/geometry";
import type { ReadBackgroundImage } from "../lib/background-image";
import type { EditorBackgroundImage, Selection, Tool, WorkspaceMode } from "../types";

export interface EditorState {
  map: MapDocument;
  workspaceMode: WorkspaceMode;
  tool: Tool;
  backgroundImage: EditorBackgroundImage | null;
  selection: Selection;
  edgeStartNodeId: string | null;
  routeNodeIds: string[];
  dragNodeId: string | null;
  viewport: CanvasBounds | null;
  status: string;
  setStatus: (status: string) => void;
  setMapDocument: (map: MapDocument, status?: string, options?: { preserveBackground?: boolean }) => void;
  updateMap: (updater: (map: MapDocument) => MapDocument) => void;
  renameMap: (name: string) => void;
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void;
  setTool: (tool: Tool) => void;
  setViewport: (viewport: CanvasBounds | null) => void;
  clearSelection: () => void;
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
  addNodeAt: (x: number, y: number) => void;
  handleEdgeNode: (nodeId: string) => void;
  addReverseEdgeForSelection: () => void;
  attachBackgroundImage: (image: ReadBackgroundImage) => void;
  updateBackgroundImage: (updater: (backgroundImage: EditorBackgroundImage) => EditorBackgroundImage) => void;
  fitBackgroundImageToMap: () => void;
  setBackgroundImageOpacity: (opacity: number) => void;
  setBackgroundImageLocked: (locked: boolean) => void;
  removeBackgroundImage: () => void;
  makeSelectedEdgeCurve: (options?: { includeReverse?: boolean }) => void;
  resetSelectedEdgeCurve: (options?: { includeReverse?: boolean }) => void;
  straightenSelectedEdge: (options?: { includeReverse?: boolean }) => void;
  bifurcateSelectedEdge: (options?: { includeReverse?: boolean }) => void;
  updateSelectedEdgeCurveHandle: (x: number, y: number, options?: { includeReverse?: boolean }) => void;
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
  workspaceMode: "map",
  tool: "select",
  backgroundImage: null,
  selection: null,
  edgeStartNodeId: null,
  routeNodeIds: [],
  dragNodeId: null,
  viewport: null,
  status: "Loading map...",

  setStatus: (status) => set({ status }),

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

  addNodeAt: (x, y) => set((state) => {
    const id = nextNodeId(state.map);
    return {
      selection: { type: "node", id },
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
      selection: { type: "edge", id: nextEdgeId(state.map, edgeStartNodeId, nodeId) },
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

  addReverseEdgeForSelection: () => set((state) => {
    if (state.selection?.type !== "edge") return {};
    const edge = state.map.edges.find((item) => item.id === state.selection?.id);
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
      map: {
        ...state.map,
        edges: [
          ...state.map.edges,
          {
            id,
            label: `${edge.to} -> ${edge.from}`,
            from: edge.to,
            to: edge.from,
            ...(edge.maxSpeed !== undefined ? { maxSpeed: edge.maxSpeed } : {}),
            ...(edge.orientation !== undefined ? { orientation: edge.orientation } : {}),
            orientationType: edge.orientationType,
            rotationAllowed: edge.rotationAllowed,
            trajectory: null,
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      status: `Added reverse edge ${id}.`,
    };
  }),

  attachBackgroundImage: (image) => set((state) => {
    const naturalWidth = positiveOr(image.naturalWidth, 100);
    const naturalHeight = positiveOr(image.naturalHeight, 100);
    const placement = fitRectToBounds(getNodeBounds(state.map), naturalWidth, naturalHeight);
    return {
      tool: "background",
      selection: null,
      edgeStartNodeId: null,
      backgroundImage: {
        src: image.src,
        fileName: image.fileName,
        mediaType: image.mediaType,
        naturalWidth,
        naturalHeight,
        ...placement,
        opacity: 0.65,
        locked: false,
      },
      status: `Added background image ${image.fileName}.`,
    };
  }),

  updateBackgroundImage: (updater) => set((state) => {
    if (!state.backgroundImage) return {};
    return {
      backgroundImage: normalizeBackgroundImage(updater(state.backgroundImage)),
    };
  }),

  fitBackgroundImageToMap: () => set((state) => {
    const backgroundImage = state.backgroundImage;
    if (!backgroundImage) return {};
    const placement = fitRectToBounds(
      getNodeBounds(state.map),
      backgroundImage.naturalWidth,
      backgroundImage.naturalHeight
    );
    return {
      backgroundImage: normalizeBackgroundImage({ ...backgroundImage, ...placement }),
      status: "Fit background image to map.",
    };
  }),

  setBackgroundImageOpacity: (opacity) => set((state) => {
    if (!state.backgroundImage) return {};
    return {
      backgroundImage: normalizeBackgroundImage({ ...state.backgroundImage, opacity }),
    };
  }),

  setBackgroundImageLocked: (locked) => set((state) => {
    if (!state.backgroundImage) return {};
    return {
      backgroundImage: { ...state.backgroundImage, locked },
      status: locked ? "Locked background image." : "Unlocked background image.",
    };
  }),

  removeBackgroundImage: () => set((state) => {
    if (!state.backgroundImage) return {};
    return {
      backgroundImage: null,
      tool: state.tool === "background" ? "select" : state.tool,
      status: "Removed background image.",
    };
  }),

  makeSelectedEdgeCurve: (options) => set((state) => {
    if (state.selection?.type !== "edge") return {};
    const next = updateSelectedEdgeTrajectory(state, (edge, from, to) => {
      const synced = syncTrajectoryEndpoints(edge, from, to);
      if (isSupportedQuadraticBezier(synced.trajectory)) return synced;
      return resetEdgeToQuadraticBezier(edge, from, to);
    }, {
      ...options,
      reverseUpdater: resetReverseEdgeToSelectedCurvePath,
    });
    return next ? { ...next, status: "Converted edge to curve." } : {};
  }),

  resetSelectedEdgeCurve: (options) => set((state) => {
    if (state.selection?.type !== "edge") return {};
    const next = updateSelectedEdgeTrajectory(
      state,
      (edge, from, to) => resetEdgeToQuadraticBezier(edge, from, to),
      {
        ...options,
        reverseUpdater: resetReverseEdgeToSelectedCurvePath,
      }
    );
    return next ? { ...next, status: "Reset edge curve." } : {};
  }),

  straightenSelectedEdge: (options) => set((state) => {
    if (state.selection?.type !== "edge") return {};
    const next = updateSelectedEdgeTrajectory(state, (edge) => ({ ...edge, trajectory: null }), options);
    return next ? { ...next, status: "Straightened edge." } : {};
  }),

  bifurcateSelectedEdge: (options) => set((state) => {
    if (state.selection?.type !== "edge") return {};
    const edge = state.map.edges.find((item) => item.id === state.selection?.id);
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
      return {
        status: "Reset unsupported imported trajectory before bifurcating this edge.",
      };
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
        return {
          status: "Reset unsupported reverse edge trajectory before bifurcating both directions.",
        };
      }
      replacementEdges.push(...reverseSplit.edges);
    }
    let insertedReplacement = false;
    const edges = state.map.edges.flatMap((item) => {
      if (item.id === edge.id) {
        insertedReplacement = true;
        return replacementEdges;
      }
      if (reverse && item.id === reverse.id) return [];
      return [item];
    });
    if (!insertedReplacement) edges.push(...replacementEdges);
    return {
      selection: { type: "node", id: split.node.id },
      map: {
        ...state.map,
        nodes: [...state.map.nodes, split.node],
        edges,
        updatedAt: new Date().toISOString(),
      },
      status: `Bifurcated edge ${edge.id}.`,
    };
  }),

  updateSelectedEdgeCurveHandle: (x, y, options) => set((state) => {
    if (state.selection?.type !== "edge") return {};
    return updateSelectedEdgeTrajectory(
      state,
      (edge, from, to) => setQuadraticBezierHandle(edge, from, to, { x, y }),
      {
        ...options,
        includeReverseWhen: edgesShareQuadraticHandle,
        reverseUpdater: resetReverseEdgeToSelectedCurvePath,
      }
    ) || {};
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
    const nodes = state.map.nodes.map((node) =>
      node.id === state.dragNodeId ? { ...node, x, y } : node
    );
    return {
      map: {
        ...state.map,
        nodes,
        edges: syncMapEdgeTrajectoryEndpoints(state.map.edges, nodes),
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
    const nodes = state.map.nodes.map((node) => node.id === previousId ? next : node);
    const edges = state.map.edges.map((edge) => ({
      ...edge,
      from: edge.from === previousId ? next.id : edge.from,
      to: edge.to === previousId ? next.id : edge.to,
    }));
    return {
      selection: { type: "node", id: next.id },
      routeNodeIds: state.routeNodeIds.map((nodeId) => nodeId === previousId ? next.id : nodeId),
      map: {
        ...state.map,
        nodes,
        edges: syncMapEdgeTrajectoryEndpoints(edges, nodes),
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  updateEdge: (next) => set((state) => {
    if (state.selection?.type !== "edge") return {};
    const from = findNode(state.map, next.from);
    const to = findNode(state.map, next.to);
    const synced = syncTrajectoryEndpoints(next, from, to);
    return {
      selection: { type: "edge", id: synced.id },
      map: {
        ...state.map,
        edges: state.map.edges.map((edge) => edge.id === state.selection?.id ? synced : edge),
        updatedAt: new Date().toISOString(),
      },
    };
  }),

  clearRoute: () => set({ routeNodeIds: [] }),
}));

function normalizeBackgroundImage(backgroundImage: EditorBackgroundImage): EditorBackgroundImage {
  return {
    ...backgroundImage,
    naturalWidth: positiveOr(backgroundImage.naturalWidth, 100),
    naturalHeight: positiveOr(backgroundImage.naturalHeight, 100),
    width: positiveOr(backgroundImage.width, 0.5),
    height: positiveOr(backgroundImage.height, 0.5),
    opacity: Math.min(1, Math.max(0, backgroundImage.opacity)),
  };
}

function positiveOr(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function updateSelectedEdgeTrajectory(
  state: EditorState,
  updater: (edge: MapEdge, from: MapNode, to: MapNode) => MapEdge,
  options: {
    includeReverse?: boolean;
    includeReverseWhen?: (edge: MapEdge, reverseEdge: MapEdge) => boolean;
    reverseUpdater?: (edge: MapEdge, from: MapNode, to: MapNode, selectedEdge: MapEdge) => MapEdge;
  } = {}
): Pick<EditorState, "map"> | null {
  if (state.selection?.type !== "edge") return null;
  const edge = state.map.edges.find((item) => item.id === state.selection?.id);
  if (!edge) return null;
  const reverseEdge = findEdge(state.map, edge.to, edge.from);
  const reverse = reverseEdge && (options.includeReverse || options.includeReverseWhen?.(edge, reverseEdge))
    ? reverseEdge
    : undefined;
  const from = findNode(state.map, edge.from);
  const to = findNode(state.map, edge.to);
  if (!from || !to) return null;
  const selectedNext = updater(edge, from, to);
  const updatedById = new Map<string, MapEdge>();

  updatedById.set(edge.id, selectedNext);
  if (reverse && reverse.id !== edge.id) {
    const reverseFrom = findNode(state.map, reverse.from);
    const reverseTo = findNode(state.map, reverse.to);
    if (!reverseFrom || !reverseTo) return null;
    updatedById.set(
      reverse.id,
      options.reverseUpdater
        ? options.reverseUpdater(reverse, reverseFrom, reverseTo, selectedNext)
        : updater(reverse, reverseFrom, reverseTo)
    );
  }

  return {
    map: {
      ...state.map,
      edges: state.map.edges.map((item) => updatedById.get(item.id) ?? item),
      updatedAt: new Date().toISOString(),
    },
  };
}
