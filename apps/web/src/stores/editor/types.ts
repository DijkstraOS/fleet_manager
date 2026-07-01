import type { BackgroundSlice } from "./background-slice";
import type { EdgeCurveSlice } from "./edge-curve-slice";
import type { MapEditSlice } from "./map-edit-slice";
import type { MapSlice } from "./map-slice";
import type { WorkspaceSlice } from "./workspace-slice";

export type EditorState = MapSlice & WorkspaceSlice & MapEditSlice & EdgeCurveSlice & BackgroundSlice;
