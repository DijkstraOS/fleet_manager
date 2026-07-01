import type { CanvasSize, MapDocument, MapEdge, MapNode } from "./types";

/**
 * Finite-floor geometry: floor bounds, viewport clamping, fit-to-content, the
 * legacy re-center-onto-floor normalization, and adaptive grid step selection.
 *
 * All of it is pure and framework-free (the architecture rule keeps map/geometry
 * math in @agv/core). The web layer wires these into viewport/render/interaction;
 * the server reuses {@link backfillCanvas} on load.
 *
 * Coordinate convention: top-left origin, the floor spans `(0,0) -> (width,height)`,
 * +X right / +Y down. No axis is flipped — a pure translation preserves every
 * `dx`/`dy` and therefore every `atan2` heading the simulator computes.
 */

/** Default floor for a fresh or canvas-less map: a 200 x 200 m square. */
export const DEFAULT_CANVAS_SIZE: CanvasSize = { width: 200, height: 200 };

/** Smallest viewport width (meters) zoom-in stops at — a tight detail level. */
export const MIN_VIEWPORT_WIDTH = 3;

/** Viewport width (meters) an empty map opens at, centered on the floor center. */
export const DEFAULT_EMPTY_VIEWPORT_WIDTH = 20;

/**
 * Breathing room kept around the floor when fully zoomed out: the whole-floor
 * view is scaled to `1 + 2 * margin` of the floor's larger dimension so the edge
 * never sits flush against the viewport border.
 */
const ZOOM_OUT_MARGIN = 0.04;

/** Padding (meters) added around the node bounding box for fit-to-content. */
const FIT_CONTENT_PADDING = 2;

/**
 * A world-space rectangle. Reused for both the floor and a viewport; `x`/`y` are
 * the top-left corner, `width`/`height` extend right/down.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The floor rectangle for a canvas size: always anchored at the origin. */
export function floorBounds(canvas: CanvasSize): Rect {
  return { x: 0, y: 0, width: canvas.width, height: canvas.height };
}

/**
 * Reshape the floor to match a background image's aspect ratio: keep `width` and
 * set `height = width / aspect`, where `aspect = imageNaturalWidth / imageNaturalHeight`.
 * The floor then matches the image exactly, so the image fills it edge-to-edge with
 * no distortion. A non-positive/non-finite aspect falls back to a square floor.
 */
export function floorSizeForImageAspect(width: number, aspect: number): CanvasSize {
  if (!(aspect > 0) || !Number.isFinite(aspect)) return { width, height: width };
  return { width, height: width / aspect };
}

/**
 * The maximum viewport width allowed before you would see past the floor: the
 * floor's larger dimension (adjusted for aspect) plus a small breathing margin.
 * Zooming out stops here with the floor centered and letterboxed on the short axis.
 */
export function maxViewportWidth(canvas: CanvasSize, aspect: number): number {
  const floorAspect = canvas.width / canvas.height;
  // Fit the whole floor: when the viewport is wider than the floor we are limited
  // by floor height (scaled up to the viewport aspect), otherwise by floor width.
  const base = aspect >= floorAspect ? canvas.height * aspect : canvas.width;
  return base * (1 + 2 * ZOOM_OUT_MARGIN);
}

/**
 * Clamp a viewport to the floor: first clamp its width into
 * `[MIN_VIEWPORT_WIDTH, maxViewportWidth]` (preserving aspect), then hard-clamp
 * its position so it never shows past a floor edge. A fully-visible axis is
 * centered (and cannot pan). Returns a new rect; never mutates the input.
 */
export function clampViewportToFloor(viewport: Rect, canvas: CanvasSize): Rect {
  const aspect = viewport.width / viewport.height;
  const width = Math.min(
    maxViewportWidth(canvas, aspect),
    Math.max(MIN_VIEWPORT_WIDTH, viewport.width)
  );
  const height = width / aspect;
  return {
    x: clampAxis(viewport.x, width, canvas.width),
    y: clampAxis(viewport.y, height, canvas.height),
    width,
    height,
  };
}

// Center the axis when the viewport covers the whole floor span, otherwise slide
// it so neither edge crosses [0, floorSpan].
function clampAxis(position: number, span: number, floorSpan: number): number {
  if (span >= floorSpan) return (floorSpan - span) / 2;
  return Math.min(Math.max(position, 0), floorSpan - span);
}

/**
 * Default fit-to-content viewport for a map's nodes at a given aspect ratio:
 * the node bounding box plus padding, recentered to the requested aspect, then
 * clamped to the floor and zoom bounds. With no nodes, opens at the empty-map
 * default (~20 m) centered on the floor center.
 */
export function fitViewportToContent(map: MapDocument, aspect: number): Rect {
  const extents = nodeExtents(map.nodes);
  if (!extents) return emptyViewport(map.canvas, aspect);
  const contentWidth = extents.maxX - extents.minX + 2 * FIT_CONTENT_PADDING;
  const contentHeight = extents.maxY - extents.minY + 2 * FIT_CONTENT_PADDING;
  const centerX = (extents.minX + extents.maxX) / 2;
  const centerY = (extents.minY + extents.maxY) / 2;
  // Grow the smaller dimension to the requested aspect so content is never cropped.
  const width = Math.max(contentWidth, contentHeight * aspect);
  const height = width / aspect;
  return clampViewportToFloor(
    { x: centerX - width / 2, y: centerY - height / 2, width, height },
    map.canvas
  );
}

/** The empty-map opening view: ~20 m wide, centered on the floor center. */
export function emptyViewport(canvas: CanvasSize, aspect: number): Rect {
  const width = DEFAULT_EMPTY_VIEWPORT_WIDTH;
  const height = width / aspect;
  return clampViewportToFloor(
    {
      x: canvas.width / 2 - width / 2,
      y: canvas.height / 2 - height / 2,
      width,
      height,
    },
    canvas
  );
}

/**
 * Clamp a point to the floor rect `[0,width] x [0,height]`. Applied to node
 * create/drag after the 0.5 m snap, so nodes can never land outside the floor.
 */
export function clampPointToFloor(x: number, y: number, canvas: CanvasSize): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 0), canvas.width),
    y: Math.min(Math.max(y, 0), canvas.height),
  };
}

/**
 * Uniformly translate a whole map so its node bounding-box center lands on the
 * floor center `(width/2, height/2)`. Every node AND every edge trajectory
 * control point shifts by the same offset, so all `dx`/`dy` and `atan2` headings
 * are unchanged. An empty map (no nodes) is returned untouched.
 *
 * This is the one-time legacy migration: a demo authored at corner coords
 * `(0,0) -> (15,10)` recenters to `(92.5,95) -> (107.5,105)`, center `(100,100)`.
 */
export function recenterMapOnFloor(map: MapDocument): MapDocument {
  const extents = nodeExtents(map.nodes);
  if (!extents) return map;
  const dx = map.canvas.width / 2 - (extents.minX + extents.maxX) / 2;
  const dy = map.canvas.height / 2 - (extents.minY + extents.maxY) / 2;
  if (dx === 0 && dy === 0) return map;
  const offset = { dx, dy };
  return {
    ...map,
    nodes: map.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy })),
    edges: map.edges.map((edge) => translateEdgeTrajectory(edge, offset)),
  };
}

/**
 * Recalibrate the floor to a new real-world size, rescaling every node and edge
 * trajectory control point about the floor origin `(0,0)` so the content stays
 * anchored to the plan. With `sx = new.width / old.width` and `sy = new.height /
 * old.height`, a node at plan-fraction `f` of the floor (e.g. half-way across)
 * stays at fraction `f` — `x *= sx`, `y *= sy`. The scale is independent per axis,
 * so an aspect-unlocked height change rescales `y` only.
 *
 * Unlike {@link recenterMapOnFloor} this is a pure scale about the origin, NOT a
 * translation: it does not recenter content. A degenerate old canvas (a zero
 * dimension, which `validateMap` already rejects) is a no-op on that axis.
 * Returns a new MapDocument; never mutates the input.
 */
export function recalibrateCanvas(map: MapDocument, newCanvas: CanvasSize): MapDocument {
  const old = map.canvas;
  const sx = old.width > 0 ? newCanvas.width / old.width : 1;
  const sy = old.height > 0 ? newCanvas.height / old.height : 1;
  if (sx === 1 && sy === 1) return { ...map, canvas: newCanvas };
  return {
    ...map,
    canvas: newCanvas,
    nodes: map.nodes.map((node) => ({ ...node, x: node.x * sx, y: node.y * sy })),
    edges: map.edges.map((edge) => scaleEdgeTrajectory(edge, sx, sy)),
  };
}

function scaleEdgeTrajectory(edge: MapEdge, sx: number, sy: number): MapEdge {
  if (!edge.trajectory) return edge;
  return {
    ...edge,
    trajectory: {
      ...edge.trajectory,
      controlPoints: edge.trajectory.controlPoints.map((point) => ({
        ...point,
        x: point.x * sx,
        y: point.y * sy,
      })),
    },
  };
}

function translateEdgeTrajectory(edge: MapEdge, offset: { dx: number; dy: number }): MapEdge {
  if (!edge.trajectory) return edge;
  return {
    ...edge,
    trajectory: {
      ...edge.trajectory,
      controlPoints: edge.trajectory.controlPoints.map((point) => ({
        ...point,
        x: point.x + offset.dx,
        y: point.y + offset.dy,
      })),
    },
  };
}

/**
 * One-time legacy migration the server applies to every `maps.json` entry on
 * load. When a map predates the `canvas` field, backfill the default 200x200
 * floor and recenter its content onto the floor center (so corner-authored demos
 * land in the middle). A map that already HAS a `canvas` is returned untouched —
 * the migration must not yank deliberately-placed nodes back to center on reload.
 */
export function backfillCanvas(map: MapDocument): MapDocument {
  if (map.canvas) return map;
  return recenterMapOnFloor({ ...map, canvas: { ...DEFAULT_CANVAS_SIZE } });
}

/** Grows/shifts the floor so off-floor content fits; no-op when already within `[0,canvas]`. Pure translate — never scales or flips. */
export function fitCanvasToContent(map: MapDocument): MapDocument {
  const extents = contentExtents(map);
  if (!extents) return map;
  const dx = extents.minX < 0 ? -extents.minX : 0;
  const dy = extents.minY < 0 ? -extents.minY : 0;
  const width = Math.max(map.canvas.width, extents.maxX + dx);
  const height = Math.max(map.canvas.height, extents.maxY + dy);
  if (dx === 0 && dy === 0 && width === map.canvas.width && height === map.canvas.height) {
    return map;
  }
  const offset = { dx, dy };
  return {
    ...map,
    canvas: { width, height },
    nodes: map.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy })),
    edges: map.edges.map((edge) => translateEdgeTrajectory(edge, offset)),
  };
}

// Adaptive grid: as the viewport widens the 1 m grid would draw too many lines,
// so the step climbs through this ladder. The threshold is the viewport width at
// which the next coarser step takes over, chosen to keep the line count legible.
const GRID_STEPS: Array<{ maxViewportWidth: number; step: number }> = [
  { maxViewportWidth: 12, step: 1 },
  { maxViewportWidth: 40, step: 5 },
  { maxViewportWidth: 120, step: 10 },
  { maxViewportWidth: Infinity, step: 25 },
];

/**
 * The grid spacing (meters) to draw for a viewport width: 1 m when zoomed in,
 * stepping 1 -> 5 -> 10 -> 25 m as you zoom out so the line count stays legible.
 */
export function gridStepForViewport(viewportWidth: number): number {
  return (GRID_STEPS.find((entry) => viewportWidth <= entry.maxViewportWidth) ?? GRID_STEPS[GRID_STEPS.length - 1]!).step;
}

function nodeExtents(nodes: MapNode[]) {
  if (nodes.length === 0) return null;
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function contentExtents(map: MapDocument) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const fold = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const node of map.nodes) fold(node.x, node.y);
  for (const edge of map.edges) {
    for (const point of edge.trajectory?.controlPoints ?? []) fold(point.x, point.y);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}
