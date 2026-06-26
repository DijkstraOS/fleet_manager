import { findEdgeById, findNode, type MapEdge, type MapNode } from "@agv/core";
import type { EditorState } from "./types";

/** The currently selected edge, or undefined when the selection is not an edge. */
export function selectedEdge(state: EditorState): MapEdge | undefined {
  return state.selection?.type === "edge" ? findEdgeById(state.map, state.selection.id) : undefined;
}

/** The currently selected node, or undefined when the selection is not a node. */
export function selectedNode(state: EditorState): MapNode | undefined {
  return state.selection?.type === "node" ? findNode(state.map, state.selection.id) : undefined;
}
