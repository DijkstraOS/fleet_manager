# Design — Consistent panels + image-defined canvas

**Status:** planned (2026-06-25) · **Backlog:** [`PANEL-1..3`](../issues/), [`CANVAS-1..3`](../issues/)

The durable "why" behind two editor changes. The work itself is sliced **vertically** into the
issue files above — each is usable and visibly changes the app when done. This doc stays; the issues
get deleted as they land.

## Problem

1. **Panels are inconsistent.** The Map tab puts the canvas on the left and one right panel that
   *mixes* mode tools, global commands, and the selection inspector in a single scroll. The Route
   tab mirrors the layout (panel left, canvas right) and likewise mixes the route **list** (browse)
   with the route being **edited** (detail). Panels sit on opposite sides between tabs, and within
   each tab "find/act" is jumbled with "inspect/edit." There's no consistent rule for *where the
   user looks for what*.

2. **The background has no canvas, no scale.** The canvas has no explicit size — it auto-fits to
   node (+ background) bounds. The image is a freely movable/scalable object inside those bounds,
   rendered stretched (`preserveAspectRatio="none"`), and is **ephemeral** (`MapDocument` has no
   canvas/background fields). The map has **no real-world scale**, even though node coordinates
   export straight to VDA 5050 / LIF `nodePosition` in meters (`packages/core/src/vda/index.ts`).

## Target model

### Panel language (all three tabs)

```
+--------+--------------------+- - - - -+
|  LEFT  |                    | RIGHT   |  <- floats over the map's right
| column |     MAP CANVAS     | card    |     edge; collapses when nothing
| tools/ |   (center, always) | (sel.   |     is selected. The map never
| lists  |                    | detail) |     reflows or rescales.
+--------+--------------------+- - - - -+
  persistent                   transient
```

- **Left column (persistent):** mode tools, browse-lists (routes, AGVs), global commands (save,
  import/export), and map-level settings (background/calibration). Where you *find and act*.
- **Center:** the map canvas, always; never reflows/rescales on selection.
- **Right card (transient):** the detail **and** selection-scoped actions for whatever is selected —
  a node/edge (curve actions, delete), a route (editor + assign-AGV + send), an AGV. Floats over the
  map's right edge; collapses to nothing when the selection is empty.

The rule a user learns: **left = your toolkit & lists; right = the thing you clicked.**

### Image-defined, calibrated canvas

- Uploading a background image **defines the canvas**: a fixed frame equal to the image bounds,
  filled aspect-correctly (replaces auto-fit while an image is present).
- **Canvas size = real-world calibration.** Enter the width in meters; height derives from image
  aspect (deliberate unlock for distorted scans). Node x/y are then real meters — to-scale for LIF.
- **Recalibration rescales existing nodes** so they stay anchored to the same spot on the plan.
- **Persistence:** calibration (meters/aspect/origin) lives in `MapDocument`; the image is a
  **server asset** referenced by the document — keeps `data/maps.json` lean and shares the basemap
  across devices. AGVs never consume the image; only calibrated node coordinates flow to LIF.
- The background tool is **type-to-calibrate** (width · aspect-unlock · opacity · replace · remove).
  The old drag-to-move + corner scale-handle are removed.

## Decisions (resolved trade-offs)

| Decision | Choice | Why |
|----------|--------|-----|
| Panel zones | left tools/lists · center map · right detail | one consistent "left = act, right = inspect" rule across tabs |
| Right card | floats over the edge, collapses when idle | the map never reflows/rescales on selection |
| Selection actions | travel with the detail (right) | no cross-screen travel between select and act |
| Scope | Map + Route + Tracking | full cross-tab consistency |
| Canvas source | image = fixed canvas frame | "the image defines the canvas" |
| "Canvas size" | real-world calibration in meters | node coordinates become to-scale for LIF/VDA |
| Aspect ratio | locked to image, with unlock escape | no distortion by default; correct skewed scans when needed |
| Recalibration | rescales node coordinates | preserve placement against the plan |
| Image storage | server asset + reference in `MapDocument` | keep `maps.json` lean; share the basemap; AGVs don't need the image |
| Background tool | type-to-calibrate; drop drag/scale | precise; deletes obsolete interaction code |

## Backlog — vertical slices (each usable when done)

**Panels** (the shared shell is built inside PANEL-1 and reused):
`PANEL-1` Map tab → `PANEL-2` Route tab → `PANEL-3` Tracking tab.

**Canvas** (model/server/geometry folded into the slice that needs it):
`CANVAS-1` image defines the canvas (in-session) → `CANVAS-2` calibrate to meters → `CANVAS-3`
persist the basemap.

Dependencies live *within* each track. The two tracks are independent — either can go first. The one
cross-track touchpoint: CANVAS slices edit the background section wherever it currently lives, and
PANEL-1 relocates that section into the left rail. No hard ordering required.

## Open implementation details (recommended defaults — confirm at build time)

- **Coordinate origin & axis:** anchor the image's top-left at the current world origin and keep the
  existing axis orientation — do **not** silently flip exported coordinates. A user-settable origin
  is a later enhancement. *(Decide in CANVAS-2.)*
- **No image present:** before upload / after remove, keep today's auto-fit-to-content.
- **Back-compat:** existing maps without calibration fields keep auto-fit and acquire fields on first
  calibration. *(CANVAS-3.)*
