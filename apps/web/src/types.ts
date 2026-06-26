import type { BackgroundImageMediaType } from "./lib/background-image";

export type WorkspaceMode = "map" | "routes" | "tracking";
export type Tool = "select" | "node" | "edge";

export type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | null;

export interface EditorBackgroundImage {
  src: string;
  fileName: string;
  mediaType: BackgroundImageMediaType;
  naturalWidth: number;
  naturalHeight: number;
  opacity: number;
}
