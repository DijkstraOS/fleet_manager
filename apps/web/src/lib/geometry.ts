import { quadraticBezierSvgPath, type MapDocument, type MapEdge, type MapNode } from "@agv/core";

export const GRID = 1;

// Parallel straight edges that share a corridor are nudged apart by this distance
// (in world units) so each direction stays individually clickable instead of
// rendering on top of its reverse twin.
export const STRAIGHT_EDGE_PARALLEL_OFFSET = 0.16;
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
  return Math.round(value / 0.5) * 0.5;
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

export function routeContainsEdge(route: string[], from: string, to: string) {
  for (let index = 0; index < route.length - 1; index += 1) {
    if (route[index] === from && route[index + 1] === to) return true;
  }
  return false;
}

export interface StraightLineGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Returns the endpoints to draw a straight edge as, offsetting it perpendicular to
// its direction when it shares a corridor with another straight edge so the two
// (typically a forward/reverse pair) do not render on top of each other.
export function getStraightLineGeometry(
  edge: MapEdge,
  from: MapNode,
  to: MapNode,
  edges: MapEdge[],
  nodes: MapNode[],
): StraightLineGeometry {
  const shouldOffset = edges.some((item) => {
    if (item.id === edge.id || quadraticBezierSvgPath(item.trajectory)) return false;
    const otherFrom = nodes.find((node) => node.id === item.from);
    const otherTo = nodes.find((node) => node.id === item.to);
    return otherFrom && otherTo && straightSegmentsOverlap(from, to, otherFrom, otherTo);
  });
  if (!shouldOffset) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };

  const canonical = canonicalStraightDirection(from, to);
  const dx = canonical.to.x - canonical.from.x;
  const dy = canonical.to.y - canonical.from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };

  const side = samePoint(from, canonical.from) && samePoint(to, canonical.to) ? 1 : -1;
  const offsetX = (-dy / length) * STRAIGHT_EDGE_PARALLEL_OFFSET * side;
  const offsetY = (dx / length) * STRAIGHT_EDGE_PARALLEL_OFFSET * side;
  return {
    x1: from.x + offsetX,
    y1: from.y + offsetY,
    x2: to.x + offsetX,
    y2: to.y + offsetY,
  };
}

// True when segment B lies along segment A's infinite line (within tolerance) and
// their projected extents overlap by more than a hair — i.e. they share a corridor.
export function straightSegmentsOverlap(aFrom: MapNode, aTo: MapNode, bFrom: MapNode, bTo: MapNode) {
  const ax = aTo.x - aFrom.x;
  const ay = aTo.y - aFrom.y;
  const lengthSquared = ax * ax + ay * ay;
  if (lengthSquared <= 0) return false;
  if (Math.abs(cross(ax, ay, bFrom.x - aFrom.x, bFrom.y - aFrom.y)) > 0.001) return false;
  if (Math.abs(cross(ax, ay, bTo.x - aFrom.x, bTo.y - aFrom.y)) > 0.001) return false;

  const bStart = dot(bFrom.x - aFrom.x, bFrom.y - aFrom.y, ax, ay) / lengthSquared;
  const bEnd = dot(bTo.x - aFrom.x, bTo.y - aFrom.y, ax, ay) / lengthSquared;
  const start = Math.max(0, Math.min(bStart, bEnd));
  const end = Math.min(1, Math.max(bStart, bEnd));
  return end - start > 0.001;
}

// Picks a stable orientation for an undirected straight segment (left-to-right, then
// bottom-to-top) so a forward/reverse edge pair offsets to opposite sides consistently.
export function canonicalStraightDirection(from: MapNode, to: MapNode) {
  if (from.x < to.x) return { from, to };
  if (from.x > to.x) return { from: to, to: from };
  if (from.y <= to.y) return { from, to };
  return { from: to, to: from };
}

function samePoint(left: MapNode, right: MapNode) {
  return left.id === right.id;
}

function cross(ax: number, ay: number, bx: number, by: number) {
  return ax * by - ay * bx;
}

function dot(ax: number, ay: number, bx: number, by: number) {
  return ax * bx + ay * by;
}
