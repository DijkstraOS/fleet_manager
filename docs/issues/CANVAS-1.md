# CANVAS-1 — Background image defines the canvas

**Area:** Canvas · **Effort:** M · **Risk:** Med

Make an uploaded image *become* the canvas instead of a movable object inside auto-fit bounds. Today
the image is fit to node bounds, freely moved/scaled, and rendered stretched
(`preserveAspectRatio="none"`); bounds auto-fit to content (`apps/web/src/lib/geometry.ts`
`getBounds`; `MapCanvasView` `BackgroundImageLayer`; `useMapCanvasController` move/scale;
`editor-store` background actions). See [design](../design/ui-panels-and-canvas.md).

**Fix:** While a background image is present, the canvas frame = the image bounds (fixed), filled
aspect-correctly (drop `preserveAspectRatio="none"`). Remove the move + corner scale-handle
interactions and the now-obsolete fit-to-map / lock controls; the background section keeps opacity +
replace + remove. No image → keep today's auto-fit-to-content. In-session only (persistence is
CANVAS-3).

**Done when:** uploading a floor plan makes it fill and fix the canvas with no distortion, the
drag/scale handle is gone, and removing the image reverts to auto-fit. Then delete this file.
