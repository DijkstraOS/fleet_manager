# CANVAS-2 — Calibrate the canvas to real-world meters

**Area:** Canvas · **Effort:** M · **Risk:** Med

Give the image-defined canvas a real-world scale so node coordinates are meters — they already export
straight to VDA/LIF `nodePosition` (`packages/core/src/vda/index.ts`). Builds on CANVAS-1. See
[design](../design/ui-panels-and-canvas.md).

**Fix:** The background section gains a width-in-meters field; height derives from image aspect, with
a deliberate unlock for distorted scans. The meters↔pixels mapping sets the world frame the image
fills. **Recalibrating rescales existing node coordinates** so they stay anchored to the plan. Put
the geometry (image→world rect, aspect-locked fill, node rescale) in `@agv/core` with **direct** unit
tests per the architecture rule.

**Origin & axis (decide here):** default — anchor the image's top-left at the current world origin
and keep the existing axis orientation; do not silently flip exported coordinates.

**Done when:** typing a width calibrates the map, placed nodes read as real meters, recalibration
keeps nodes on the same plan spot, and LIF export is to-scale. Then delete this file.
