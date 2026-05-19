import type { MapDocument } from "@agv/core";

export const GRID = 1;

export function getBounds(map: MapDocument) {
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

export function routeContainsEdge(route: string[], from: string, to: string) {
  for (let index = 0; index < route.length - 1; index += 1) {
    if (route[index] === from && route[index + 1] === to) return true;
  }
  return false;
}
