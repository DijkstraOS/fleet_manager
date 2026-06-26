import { clampViewportToFloor, type CanvasSize, } from "@agv/core";

export const GRID = 1;

// Node rendering radii, in world units (real meters) — a node keeps the same
// physical footprint on the floor at any zoom. Action/station nodes stay hefty;
// pure path-support nodes render as a small dot that blends into the path. A
// support node's pointer target is its own visible dot — no enlarged hit area —
// so a drag only catches it within the dot you can actually see.
export const ACTION_NODE_RADIUS = 0.28;
export const SUPPORT_NODE_RADIUS = 0.06;

// An incoming edge to an action node stops this far short of the node center so
// its arrowhead tip rests snug against the node ring. Without this the tip lands
// at the center, where the node — and any overlapping reverse-twin edge drawn on
// top — swallow the head. Tuned just inside ACTION_NODE_RADIUS so the tip meets
// the ring with no gap; larger values float the head off the node.
export const ARROW_NODE_STANDOFF = 0.15;

// Bézier curve-drag handle: twice a support node so it reads as a grabbable knob
// without dominating the canvas.
export const CURVE_HANDLE_RADIUS = SUPPORT_NODE_RADIUS;

// Node placement snaps to this lattice (in world units / meters). This is finer
// than the drawn GRID on purpose: the visual grid stays at 1 m for legibility while
// coordinates land on clean 0.1 m increments. Kept as 1/SNAP_STEP so we can round
// via integers (Math.round(v * SNAP_PER_UNIT) / SNAP_PER_UNIT) and avoid the float
// dust that Math.round(v / 0.1) * 0.1 reintroduces.
const SNAP_PER_UNIT = 10;

// Wheel-zoom tuning. Wheel events report their delta in pixels, lines, or pages
// (deltaMode); we normalize everything to pixels so a mouse notch and a trackpad
// swipe stay comparable, then clamp per event so one large notch cannot jump
// straight to the zoom limit.
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_LINE_HEIGHT_PX = 16;
const WHEEL_PAGE_HEIGHT_PX = 400;
const WHEEL_MAX_STEP_PX = 120;

export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function snap(value: number) {
  return Math.round(value * SNAP_PER_UNIT) / SNAP_PER_UNIT;
}

export function screenToWorld(svg: SVGSVGElement, clientX: number, clientY: number) {
  const transformed = screenToWorldRaw(svg, clientX, clientY);
  return { x: snap(transformed.x), y: snap(transformed.y) };
}

export function screenToWorldRaw(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
  return { x: transformed.x, y: transformed.y };
}

// Zoom around an anchor, then clamp to the finite floor: the core clamp caps the
// width into [min, whole-floor], so a zoom past either limit settles at it instead
// of scrolling into the void.
export function zoomViewport(
  viewport: CanvasBounds,
  anchor: { x: number; y: number },
  scale: number,
  canvas: CanvasSize,
): CanvasBounds {
  const nextWidth = viewport.width * scale;
  const nextHeight = viewport.height * scale;
  const anchorXRatio = (anchor.x - viewport.x) / viewport.width;
  const anchorYRatio = (anchor.y - viewport.y) / viewport.height;
  return clampViewportToFloor(
    {
      x: anchor.x - anchorXRatio * nextWidth,
      y: anchor.y - anchorYRatio * nextHeight,
      width: nextWidth,
      height: nextHeight,
    },
    canvas,
  );
}

export function wheelZoomScale(event: { deltaY: number; deltaMode: number }): number {
  const unit =
    event.deltaMode === 1 ? WHEEL_LINE_HEIGHT_PX : event.deltaMode === 2 ? WHEEL_PAGE_HEIGHT_PX : 1;
  const deltaPixels = event.deltaY * unit;
  const clamped = Math.max(-WHEEL_MAX_STEP_PX, Math.min(WHEEL_MAX_STEP_PX, deltaPixels));
  // exp() keeps the gesture reversible: scrolling in and back out by the same
  // distance returns to the original scale. deltaY < 0 (scroll up) -> < 1 (zoom in).
  return Math.exp(clamped * WHEEL_ZOOM_SENSITIVITY);
}

// Pan, then hard-clamp to the floor so the viewport never shows past an edge and a
// fully-visible axis stays centered.
export function panViewport(
  viewport: CanvasBounds,
  deltaX: number,
  deltaY: number,
  canvas: CanvasSize,
): CanvasBounds {
  return clampViewportToFloor(
    { ...viewport, x: viewport.x + deltaX, y: viewport.y + deltaY },
    canvas,
  );
}

// Visible radius for a node's main circle, in world units — a fixed real-world
// size at any zoom. Full nodes (a label OR actions) keep their hefty look; pure
// path-support nodes render as a small dot that doubles as their pointer target.
export function nodeRenderRadius(isSupport: boolean): number {
  return isSupport ? SUPPORT_NODE_RADIUS : ACTION_NODE_RADIUS;
}

// Pull an edge's terminal point back from the target node center by
// ARROW_NODE_STANDOFF along the incoming direction, so an arrowhead tip lands
// against the node ring rather than at its center. `approach` supplies that
// direction — the source node for a straight edge, the curve handle for a
// quadratic. Returns the target unchanged when the edge is too short to trim.
export function arrowStandoffPoint(
  approach: { x: number; y: number },
  target: { x: number; y: number },
): { x: number; y: number } {
  const dx = target.x - approach.x;
  const dy = target.y - approach.y;
  const length = Math.hypot(dx, dy);
  if (length <= ARROW_NODE_STANDOFF) return target;
  const ratio = (length - ARROW_NODE_STANDOFF) / length;
  return { x: approach.x + dx * ratio, y: approach.y + dy * ratio };
}

export function routeContainsEdge(route: string[], from: string, to: string) {
  for (let index = 0; index < route.length - 1; index += 1) {
    if (route[index] === from && route[index + 1] === to) return true;
  }
  return false;
}
