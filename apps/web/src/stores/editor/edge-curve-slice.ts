import {
  edgesShareQuadraticHandle,
  findEdge,
  findNode,
  isSupportedQuadraticBezier,
  replaceEdge,
  resetEdgeToQuadraticBezier,
  resetReverseEdgeToSelectedCurvePath,
  setQuadraticBezierHandle,
  syncTrajectoryEndpoints,
  type MapEdge,
  type MapNode,
} from "@agv/core";
import type { StateCreator } from "zustand";
import { selectedEdge } from "./guards";
import { stampMap } from "./stamp";
import type { EditorState } from "./types";

export interface EdgeCurveSlice {
  makeSelectedEdgeCurve: (options?: { includeReverse?: boolean }) => void;
  resetSelectedEdgeCurve: (options?: { includeReverse?: boolean }) => void;
  straightenSelectedEdge: (options?: { includeReverse?: boolean }) => void;
  updateSelectedEdgeCurveHandle: (x: number, y: number, options?: { includeReverse?: boolean }) => void;
}

export const createEdgeCurveSlice: StateCreator<EditorState, [], [], EdgeCurveSlice> = (set) => ({
  makeSelectedEdgeCurve: (options) => set((state) => curveUpdate(state, (edge, from, to) => {
    const synced = syncTrajectoryEndpoints(edge, from, to);
    if (isSupportedQuadraticBezier(synced.trajectory)) return synced;
    return resetEdgeToQuadraticBezier(edge, from, to);
  }, { ...options, reverseUpdater: resetReverseEdgeToSelectedCurvePath }, "Converted edge to curve.")),

  resetSelectedEdgeCurve: (options) => set((state) => curveUpdate(
    state,
    (edge, from, to) => resetEdgeToQuadraticBezier(edge, from, to),
    { ...options, reverseUpdater: resetReverseEdgeToSelectedCurvePath },
    "Reset edge curve.",
  )),

  straightenSelectedEdge: (options) => set((state) => curveUpdate(
    state,
    (edge) => ({ ...edge, trajectory: null }),
    options ?? {},
    "Straightened edge.",
  )),

  updateSelectedEdgeCurveHandle: (x, y, options) => set((state) => curveUpdate(
    state,
    (edge, from, to) => setQuadraticBezierHandle(edge, from, to, { x, y }),
    { ...options, includeReverseWhen: edgesShareQuadraticHandle, reverseUpdater: resetReverseEdgeToSelectedCurvePath },
  )),
});

interface CurveOptions {
  includeReverse?: boolean;
  includeReverseWhen?: (edge: MapEdge, reverseEdge: MapEdge) => boolean;
  reverseUpdater?: (edge: MapEdge, from: MapNode, to: MapNode, selectedEdge: MapEdge) => MapEdge;
}

function curveUpdate(
  state: EditorState,
  updater: (edge: MapEdge, from: MapNode, to: MapNode) => MapEdge,
  options: CurveOptions,
  status?: string,
): Partial<EditorState> {
  const edges = selectedCurveEdges(state, updater, options);
  if (!edges) return {};
  return {
    ...(status !== undefined ? { status } : {}),
    map: stampMap(state.map, ...edges.map((edge) => replaceEdge(edge.id, edge))),
  };
}

function selectedCurveEdges(
  state: EditorState,
  updater: (edge: MapEdge, from: MapNode, to: MapNode) => MapEdge,
  options: CurveOptions,
): MapEdge[] | null {
  const edge = selectedEdge(state);
  if (!edge) return null;
  const reverseEdge = findEdge(state.map, edge.to, edge.from);
  const reverse = reverseEdge && (options.includeReverse || options.includeReverseWhen?.(edge, reverseEdge))
    ? reverseEdge
    : undefined;
  const from = findNode(state.map, edge.from);
  const to = findNode(state.map, edge.to);
  if (!from || !to) return null;
  const selectedNext = updater(edge, from, to);
  const updated = [selectedNext];

  if (reverse && reverse.id !== edge.id) {
    const reverseFrom = findNode(state.map, reverse.from);
    const reverseTo = findNode(state.map, reverse.to);
    if (!reverseFrom || !reverseTo) return null;
    updated.push(
      options.reverseUpdater
        ? options.reverseUpdater(reverse, reverseFrom, reverseTo, selectedNext)
        : updater(reverse, reverseFrom, reverseTo)
    );
  }

  return updated;
}
