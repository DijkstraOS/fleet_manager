import { clampViewportToFloor, type CanvasSize, } from "@agv/core";

export const GRID = 1;

export const ACTION_NODE_RADIUS = 0.28;
export const SUPPORT_NODE_RADIUS = 0.06;

// An incoming edge to an action node stops this far short of the node center so
// its arrowhead tip rests snug against the node ring.
export const ARROW_NODE_STANDOFF = 0.15;

export const CURVE_HANDLE_RADIUS = SUPPORT_NODE_RADIUS;

// Integer factor, not 0.1: Math.round(v * SNAP_PER_UNIT) / SNAP_PER_UNIT avoids the float dust that Math.round(v / 0.1) * 0.1 reintroduces.
const SNAP_PER_UNIT = 10;

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
  return Math.exp(clamped * WHEEL_ZOOM_SENSITIVITY);
}

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

export function nodeRenderRadius(isSupport: boolean): number {
  return isSupport ? SUPPORT_NODE_RADIUS : ACTION_NODE_RADIUS;
}

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
