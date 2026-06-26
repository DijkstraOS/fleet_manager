import { create } from "zustand";
import { createBackgroundSlice } from "./editor/background-slice";
import { createEdgeCurveSlice } from "./editor/edge-curve-slice";
import { createMapEditSlice } from "./editor/map-edit-slice";
import { createMapSlice } from "./editor/map-slice";
import { createWorkspaceSlice } from "./editor/workspace-slice";
import type { EditorState } from "./editor/types";

export type { EditorState };

export const useEditorStore = create<EditorState>()((...a) => ({
  ...createMapSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createMapEditSlice(...a),
  ...createEdgeCurveSlice(...a),
  ...createBackgroundSlice(...a),
}));
