import { DEFAULT_CANVAS_SIZE, floorSizeForImageAspect, recalibrateCanvas } from "@agv/core";
import type { StateCreator } from "zustand";
import type { ReadBackgroundImage } from "../../lib/background-image";
import type { EditorBackgroundImage } from "../../types";
import type { EditorState } from "./types";

export interface BackgroundSlice {
  backgroundImage: EditorBackgroundImage | null;
  // Ephemeral UI state: when an image is attached the floor height is locked to
  // the image aspect (height = width / aspect). The user can unlock it to
  // calibrate a distorted scan's height independently. NOT persisted in the map.
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

  // A background image is the source of truth for the floor's SHAPE: the floor
  // keeps its current width and adopts the image's aspect ratio, so the image
  // fills it edge-to-edge with no distortion (CANVAS-1).
  attachBackgroundImage: (image) => {
    const naturalWidth = positiveOr(image.naturalWidth, 100);
    const naturalHeight = positiveOr(image.naturalHeight, 100);
    get().updateMap((map) => ({
      ...map,
      canvas: floorSizeForImageAspect(map.canvas.width, naturalWidth / naturalHeight),
    }));
    set({
      selection: null,
      edgeStartNodeId: null,
      // A fresh image re-locks the height to its aspect by default.
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

  // Removing the image reverts the floor to the CANVAS-0 default square floor.
  removeBackgroundImage: () => {
    if (!get().backgroundImage) return;
    get().updateMap((map) => recalibrateCanvas(map, { ...DEFAULT_CANVAS_SIZE }));
    set({
      backgroundImage: null,
      heightAspectLocked: true,
      status: "Removed background image.",
    });
  },

  // Calibrate the floor width (meters). When an image is attached and its height
  // is aspect-locked, the height follows (uniform rescale); otherwise only the
  // width axis rescales. Existing nodes/curves stay anchored to the plan.
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

  // Calibrate the floor height (meters) on the y axis only. Used when the height
  // is unlocked (a distorted scan) or no image constrains the aspect.
  setCanvasHeight: (height) => {
    if (!(height > 0)) return;
    get().updateMap((map) => recalibrateCanvas(map, { width: map.canvas.width, height }));
  },

  setHeightAspectLocked: (locked) => {
    set({ heightAspectLocked: locked });
    // Re-locking snaps the height back to the image aspect at the current width.
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
