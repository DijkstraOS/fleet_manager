# Design — Consistent panels + image-defined canvas

**Status:** planned (2026-06-25) · **Backlog:** [`PANEL-1..3`](../issues/), [`CANVAS-0..3`](../issues/)

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

### Finite floor, image-defined, calibrated

- **The floor is finite and primary.** The canvas is a bounded factory floor with a real meter size
  (default 200×200 m), persisted in `MapDocument`; zoom/pan are clamped to it, and coordinates are
  positive from a top-left origin (+X right / +Y down). This exists with or without an image, and is
  the prerequisite every other canvas behaviour builds on. *(CANVAS-0.)*
- Uploading a background image **redefines the floor's shape**: the floor adopts the image's aspect
  ratio and the image fills it edge-to-edge, aspect-correct — the plan is the source of truth for the
  canvas's shape. *(CANVAS-1.)*
- **Canvas size = real-world calibration.** Enter the width in meters; height derives from image
  aspect (deliberate unlock for distorted scans). Node x/y are then real meters — to-scale for LIF.
  *(CANVAS-2.)*
- **Recalibration rescales existing nodes** so they stay anchored to the same spot on the plan.
  *(CANVAS-2.)*
- **Persistence:** the `canvas` size lives in `MapDocument` from the start (CANVAS-0); the image is a
  **server asset** referenced by the document (CANVAS-3) — keeps `data/maps.json` lean and shares the
  basemap across devices. AGVs never consume the image; only calibrated node coordinates flow to LIF.
- The background tool is **type-to-calibrate** (width · aspect-unlock · opacity · replace · remove).
  The old drag-to-move + corner scale-handle are removed. *(CANVAS-1/2.)*

## Decisions (resolved trade-offs)

| Decision | Choice | Why |
|----------|--------|-----|
| Panel zones | left tools/lists · center map · right detail | one consistent "left = act, right = inspect" rule across tabs |
| Right card | floats over the edge, collapses when idle | the map never reflows/rescales on selection |
| Selection actions | travel with the detail (right) | no cross-screen travel between select and act |
| Scope | Map + Route + Tracking | full cross-tab consistency |
| Canvas primitive | finite floor, persisted, positive coords | a factory floor is bounded; the infinite canvas was the root of editor bugs |
| Canvas source | image redefines the floor's shape (when present) | the floor plan is the source of truth |
| "Canvas size" | real-world calibration in meters | node coordinates become to-scale for LIF/VDA |
| Aspect ratio | locked to image, with unlock escape | no distortion by default; correct skewed scans when needed |
| Recalibration | rescales node coordinates | preserve placement against the plan |
| Image storage | server asset + reference in `MapDocument` | keep `maps.json` lean; share the basemap; AGVs don't need the image |
| Background tool | type-to-calibrate; drop drag/scale | precise; deletes obsolete interaction code |

## Backlog — vertical slices (each usable when done)

**Panels** (the shared shell is built inside PANEL-1 and reused):
`PANEL-1` Map tab → `PANEL-2` Route tab → `PANEL-3` Tracking tab.

**Canvas** (model/server/geometry folded into the slice that needs it):
`CANVAS-0` finite floor primitive → `CANVAS-1` image redefines the floor shape → `CANVAS-2` calibrate
to meters → `CANVAS-3` persist the basemap image. CANVAS-0 is a hard prerequisite for the rest.

Dependencies live *within* each track. The two tracks are independent — either can go first. The one
cross-track touchpoint: CANVAS slices edit the background section wherever it currently lives, and
PANEL-1 relocates that section into the left rail. No hard ordering required.

## Open implementation details (recommended defaults — confirm at build time)

- **Coordinate origin & axis:** top-left origin at world `(0,0)`, +X right / +Y down, positive
  coordinates; never silently flip exported coordinates. A user-settable origin is a later
  enhancement. *(Decided in CANVAS-0; keep the existing simulator-compatible orientation.)*
- **No image present:** show CANVAS-0's default finite floor (200×200 m), not auto-fit.
- **Back-compat:** existing maps without a `canvas` field backfill the default floor on load and
  acquire the field on next save (CANVAS-0); maps without a `background` ref show no basemap
  (CANVAS-3). Legacy maps with out-of-floor (e.g. negative) coordinates are translated onto the floor
  on load — never scaled or flipped, so simulator headings are unchanged. *(CANVAS-0.)*
