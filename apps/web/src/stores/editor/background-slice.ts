import { floorSizeForImageAspect, recalibrateCanvas } from "@agv/core";
import type { StateCreator } from "zustand";
import type { ReadBackgroundImage } from "../../lib/background-image";
import type { EditorBackgroundImage } from "../../types";
import type { EditorState } from "./types";

export interface BackgroundSlice {
  backgroundImage: EditorBackgroundImage | null;
  // Ephemeral UI state, not persisted in the map.
  heightAspectLocked: boolean;
  attachBackgroundImage: (image: ReadBackgroundImage) => void;
  setBackgroundImageOpacity: (opacity: number) => void;
  removeBackgroundImage: () => void;
  setCanvasWidth: (width: number) => void;
  setCanvasHeight: (height: number) => void;
  setHeightAspectLocked: (locked: boolean) => void;
}

export const createBackgroundSlice: StateCreator<EditorState, [], [], BackgroundSlice> = (set, get) => ({
  backgroundImage: null,
  heightAspectLocked: true,

  attachBackgroundImage: (image) => {
    const naturalWidth = positiveOr(image.naturalWidth, 100);
    const naturalHeight = positiveOr(image.naturalHeight, 100);
    get().updateMap((map) =>
      recalibrateCanvas(map, floorSizeForImageAspect(map.canvas.width, naturalWidth / naturalHeight))
    );
    set({
      selection: null,
      edgeStartNodeId: null,
      heightAspectLocked: true,
      backgroundImage: {
        src: image.src,
        fileName: image.fileName,
        mediaType: image.mediaType,
        naturalWidth,
        naturalHeight,
        opacity: 0.65,
      },
      status: `Added background image ${image.fileName}.`,
    });
  },

  setBackgroundImageOpacity: (opacity) => set((state) => {
    if (!state.backgroundImage) return {};
    return {
      backgroundImage: { ...state.backgroundImage, opacity: clamp01(opacity) },
    };
  }),

  removeBackgroundImage: () => {
    if (!get().backgroundImage) return;
    // Keep the calibrated floor and node positions; rescaling here would corrupt real-world coordinates.
    set({
      backgroundImage: null,
      heightAspectLocked: true,
      status: "Removed background image.",
    });
  },

  setCanvasWidth: (width) => {
    if (!(width > 0)) return;
    const { backgroundImage, heightAspectLocked } = get();
    get().updateMap((map) => {
      const height = backgroundImage && heightAspectLocked
        ? floorSizeForImageAspect(width, backgroundImage.naturalWidth / backgroundImage.naturalHeight).height
        : map.canvas.height;
      return recalibrateCanvas(map, { width, height });
    });
  },

  setCanvasHeight: (height) => {
    if (!(height > 0)) return;
    get().updateMap((map) => recalibrateCanvas(map, { width: map.canvas.width, height }));
  },

  setHeightAspectLocked: (locked) => {
    set({ heightAspectLocked: locked });
    if (!locked) return;
    const { backgroundImage } = get();
    if (!backgroundImage) return;
    get().updateMap((map) =>
      recalibrateCanvas(
        map,
        floorSizeForImageAspect(map.canvas.width, backgroundImage.naturalWidth / backgroundImage.naturalHeight)
      )
    );
  },
});

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function positiveOr(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
