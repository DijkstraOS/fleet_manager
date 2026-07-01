import { findEdgeById, findNode, type MapEdge, type MapNode } from "@agv/core";
import type { EditorState } from "./types";

export function selectedEdge(state: EditorState): MapEdge | undefined {
  return state.selection?.type === "edge" ? findEdgeById(state.map, state.selection.id) : undefined;
}

export function selectedNode(state: EditorState): MapNode | undefined {
  return state.selection?.type === "node" ? findNode(state.map, state.selection.id) : undefined;
}
