import {
  type MapDocument,
} from "@agv/core";

export const GRID = 1;

// Node rendering radii, in world units. Action/station nodes stay hefty; pure
// path-support nodes shrink to a small dot that blends into the path. Both tiers
// keep an invisible hit-target so a tiny dot is still easy to grab.
export const ACTION_NODE_RADIUS = 0.28;
export const SUPPORT_NODE_RADIUS = 0.08;
export const SUPPORT_NODE_HIT_RADIUS = 0.2;

// Support dots are floored to this fraction of the viewport width so they never
// shrink away when zoomed out. The pixel size of a world-unit radius is
// proportional to (radius / viewportWidth), so flooring as a fraction of the
// viewport keeps a roughly constant minimum on-screen size at any zoom level.
const SUPPORT_NODE_MIN_VIEWPORT_FRACTION = 0.006;

// Node placement snaps to this lattice (in world units / meters). This is finer
// than the drawn GRID on purpose: the visual grid stays at 1 m for legibility while
// coordinates land on clean 0.1 m increments. Kept as 1/SNAP_STEP so we can round
// via integers (Math.round(v * SNAP_PER_UNIT) / SNAP_PER_UNIT) and avoid the float
// dust that Math.round(v / 0.1) * 0.1 reintroduces.
const SNAP_PER_UNIT = 10;

export const MIN_VIEWPORT_WIDTH = 3;
export const MAX_VIEWPORT_WIDTH = 80;

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

interface BackgroundBoundsSource {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getBounds(map: MapDocument, backgroundImage: BackgroundBoundsSource | null = null): CanvasBounds {
  const nodeBounds = getNodeExtents(map);
  const backgroundBounds = backgroundImage
    ? {
      minX: backgroundImage.x,
      maxX: backgroundImage.x + backgroundImage.width,
      minY: backgroundImage.y,
      maxY: backgroundImage.y + backgroundImage.height,
    }
    : null;
  const extents = combineExtents(nodeBounds, backgroundBounds);
  return extents ? padExtents(extents) : defaultBounds();
}

export function getNodeBounds(map: MapDocument): CanvasBounds {
  const extents = getNodeExtents(map);
  return extents ? padExtents(extents) : defaultBounds();
}

export function fitRectToBounds(bounds: CanvasBounds, naturalWidth: number, naturalHeight: number): CanvasBounds {
  const aspect = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  const boundsAspect = bounds.width / bounds.height;
  const width = aspect >= boundsAspect ? bounds.width : bounds.height * aspect;
  const height = aspect >= boundsAspect ? bounds.width / aspect : bounds.height;
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  };
}

function defaultBounds(): CanvasBounds {
  return { x: -2, y: -2, width: 20, height: 14 };
}

function getNodeExtents(map: MapDocument) {
  if (map.nodes.length === 0) return null;
  const xs = map.nodes.map((node) => node.x);
  const ys = map.nodes.map((node) => node.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

type Extents = NonNullable<ReturnType<typeof getNodeExtents>>;

function combineExtents(first: Extents | null, second: Extents | null) {
  if (!first) return second;
  if (!second) return first;
  return {
    minX: Math.min(first.minX, second.minX),
    maxX: Math.max(first.maxX, second.maxX),
    minY: Math.min(first.minY, second.minY),
    maxY: Math.max(first.maxY, second.maxY),
  };
}

function padExtents(extents: Extents): CanvasBounds {
  const minX = extents.minX;
  const maxX = extents.maxX;
  const minY = extents.minY;
  const maxY = extents.maxY;
  return {
    x: minX - 2,
    y: minY - 2,
    width: Math.max(maxX - minX + 4, 12),
    height: Math.max(maxY - minY + 4, 8),
  };
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

export function zoomViewport(viewport: CanvasBounds, anchor: { x: number; y: number }, scale: number): CanvasBounds {
  const nextWidth = Math.min(MAX_VIEWPORT_WIDTH, Math.max(MIN_VIEWPORT_WIDTH, viewport.width * scale));
  const effectiveScale = nextWidth / viewport.width;
  const nextHeight = viewport.height * effectiveScale;
  const anchorXRatio = (anchor.x - viewport.x) / viewport.width;
  const anchorYRatio = (anchor.y - viewport.y) / viewport.height;
  return {
    x: anchor.x - anchorXRatio * nextWidth,
    y: anchor.y - anchorYRatio * nextHeight,
    width: nextWidth,
    height: nextHeight,
  };
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

export function panViewport(viewport: CanvasBounds, deltaX: number, deltaY: number): CanvasBounds {
  return {
    ...viewport,
    x: viewport.x + deltaX,
    y: viewport.y + deltaY,
  };
}

// Visible radius for a node's main circle. Action/station nodes keep their hefty
// look; support nodes render as a small dot, floored against the viewport width
// so they stay visible (never vanish) when zoomed out.
export function nodeRenderRadius(isAction: boolean, viewportWidth: number): number {
  if (isAction) return ACTION_NODE_RADIUS;
  const floor = viewportWidth * SUPPORT_NODE_MIN_VIEWPORT_FRACTION;
  return Math.max(SUPPORT_NODE_RADIUS, floor);
}

export function routeContainsEdge(route: string[], from: string, to: string) {
  for (let index = 0; index < route.length - 1; index += 1) {
    if (route[index] === from && route[index + 1] === to) return true;
  }
  return false;
}
