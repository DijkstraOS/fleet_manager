import type { BackgroundSlice } from "./background-slice";
import type { EdgeCurveSlice } from "./edge-curve-slice";
import type { MapEditSlice } from "./map-edit-slice";
import type { MapSlice } from "./map-slice";
import type { WorkspaceSlice } from "./workspace-slice";

/**
 * The combined editor store: the intersection of every slice. Each slice owns a
 * disjoint set of state keys but reads the others through `get()`, so the
 * cross-cutting `map`/`selection` are reachable from any slice.
 */
export type EditorState = MapSlice & WorkspaceSlice & MapEditSlice & EdgeCurveSlice & BackgroundSlice;
