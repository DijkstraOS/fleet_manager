import type { StateCreator } from "zustand";
import { fitRectToBounds, getNodeBounds } from "../../lib/geometry";
import type { ReadBackgroundImage } from "../../lib/background-image";
import type { EditorBackgroundImage } from "../../types";
import type { EditorState } from "./types";

export interface BackgroundSlice {
  backgroundImage: EditorBackgroundImage | null;
  attachBackgroundImage: (image: ReadBackgroundImage) => void;
  updateBackgroundImage: (updater: (backgroundImage: EditorBackgroundImage) => EditorBackgroundImage) => void;
  fitBackgroundImageToMap: () => void;
  setBackgroundImageOpacity: (opacity: number) => void;
  setBackgroundImageLocked: (locked: boolean) => void;
  removeBackgroundImage: () => void;
}

export const createBackgroundSlice: StateCreator<EditorState, [], [], BackgroundSlice> = (set) => ({
  backgroundImage: null,

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
});

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
