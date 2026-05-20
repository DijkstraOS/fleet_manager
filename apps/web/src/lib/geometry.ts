import type { MapDocument } from "@agv/core";

export const GRID = 1;
export const MIN_VIEWPORT_WIDTH = 3;
export const MAX_VIEWPORT_WIDTH = 80;

export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getBounds(map: MapDocument): CanvasBounds {
  if (map.nodes.length === 0) return { x: -2, y: -2, width: 20, height: 14 };
  const xs = map.nodes.map((node) => node.x);
  const ys = map.nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
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
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
  return { x: snap(transformed.x), y: snap(transformed.y) };
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
