import type { MapEdge, MapNode } from "@agv/core";
import { describe, expect, it } from "vitest";
import {
  canonicalStraightDirection,
  getStraightLineGeometry,
  straightSegmentsOverlap,
  wheelZoomScale,
  zoomViewport,
} from "./geometry";

function node(id: string, x: number, y: number): MapNode {
  return { id, label: id, x, y };
}

function straightEdge(id: string, from: string, to: string): MapEdge {
  return {
    id,
    label: id,
    from,
    to,
    orientationType: "GLOBAL",
    rotationAllowed: true,
    trajectory: null,
  };
}

describe("viewport geometry", () => {
  it("zooms around the provided anchor point", () => {
    const viewport = { x: 0, y: 0, width: 10, height: 5 };

    const next = zoomViewport(viewport, { x: 5, y: 2.5 }, 0.5);

    expect(next.width).toBe(5);
    expect(next.height).toBe(2.5);
    expect(next.x).toBe(2.5);
    expect(next.y).toBe(1.25);
  });
});

describe("wheelZoomScale", () => {
  it("zooms in for scroll up and out for scroll down", () => {
    expect(wheelZoomScale({ deltaY: -100, deltaMode: 0 })).toBeLessThan(1);
    expect(wheelZoomScale({ deltaY: 100, deltaMode: 0 })).toBeGreaterThan(1);
  });

  it("is reversible: opposite scrolls cancel out", () => {
    const zoomIn = wheelZoomScale({ deltaY: -40, deltaMode: 0 });
    const zoomOut = wheelZoomScale({ deltaY: 40, deltaMode: 0 });
    expect(zoomIn * zoomOut).toBeCloseTo(1, 10);
  });

  it("scales with scroll magnitude", () => {
    const small = wheelZoomScale({ deltaY: 10, deltaMode: 0 });
    const large = wheelZoomScale({ deltaY: 50, deltaMode: 0 });
    expect(large).toBeGreaterThan(small);
  });

  it("normalizes line and page deltas against pixel deltas", () => {
    const pixel = wheelZoomScale({ deltaY: 10, deltaMode: 0 });
    const line = wheelZoomScale({ deltaY: 1, deltaMode: 1 });
    const page = wheelZoomScale({ deltaY: 0.2, deltaMode: 2 });
    expect(line).toBeGreaterThan(pixel);
    expect(page).toBeGreaterThan(line);
  });

  it("clamps a single large event so it cannot slam the zoom limit", () => {
    const huge = wheelZoomScale({ deltaY: 100000, deltaMode: 0 });
    const clampedReference = wheelZoomScale({ deltaY: 120, deltaMode: 0 });
    expect(huge).toBe(clampedReference);
  });
});

describe("straightSegmentsOverlap", () => {
  it("detects overlapping collinear segments", () => {
    // A: (0,0)->(4,0), B: (2,0)->(6,0). Projected onto A, B spans t in [0.5, 1.5],
    // clamped to [0.5, 1] -> overlap length 0.5 > tolerance.
    const overlap = straightSegmentsOverlap(node("a", 0, 0), node("b", 4, 0), node("c", 2, 0), node("d", 6, 0));
    expect(overlap).toBe(true);
  });

  it("rejects collinear segments that do not project onto each other", () => {
    // A: (0,0)->(1,0), B: (2,0)->(3,0). B projects to t in [2, 3]; clamp gives
    // start=2, end=1 -> negative overlap.
    const overlap = straightSegmentsOverlap(node("a", 0, 0), node("b", 1, 0), node("c", 2, 0), node("d", 3, 0));
    expect(overlap).toBe(false);
  });

  it("rejects parallel-but-offset segments as non-collinear", () => {
    // A along y=0, B along y=1. cross(A_dir, B_start) = 4 != 0 (beyond tolerance).
    const overlap = straightSegmentsOverlap(node("a", 0, 0), node("b", 4, 0), node("c", 0, 1), node("d", 4, 1));
    expect(overlap).toBe(false);
  });

  it("rejects a zero-length first segment", () => {
    const overlap = straightSegmentsOverlap(node("a", 0, 0), node("b", 0, 0), node("c", 0, 0), node("d", 4, 0));
    expect(overlap).toBe(false);
  });
});

describe("canonicalStraightDirection", () => {
  it("orders a reversed segment left-to-right by x", () => {
    const right = node("right", 2, 0);
    const left = node("left", 0, 0);
    const canonical = canonicalStraightDirection(right, left);
    expect(canonical.from).toBe(left);
    expect(canonical.to).toBe(right);
  });

  it("breaks an x-tie by smaller-or-equal y first", () => {
    const lower = node("lower", 0, 0);
    const upper = node("upper", 0, 5);
    expect(canonicalStraightDirection(upper, lower).from).toBe(lower);
    expect(canonicalStraightDirection(lower, upper).from).toBe(lower);
  });
});

describe("getStraightLineGeometry", () => {
  it("returns raw endpoints when no other straight edge shares the corridor", () => {
    const a = node("A", 0, 0);
    const b = node("B", 4, 0);
    const edge = straightEdge("e1", "A", "B");
    expect(getStraightLineGeometry(edge, a, b, [edge], [a, b])).toEqual({ x1: 0, y1: 0, x2: 4, y2: 0 });
  });

  it("offsets a forward/reverse pair to opposite sides of the corridor", () => {
    // A=(0,0), B=(4,0). Canonical direction is A->B (dx=4, dy=0), perpendicular is
    // (0,1). Offset magnitude is STRAIGHT_EDGE_PARALLEL_OFFSET = 0.16.
    const a = node("A", 0, 0);
    const b = node("B", 4, 0);
    const forward = straightEdge("e1", "A", "B");
    const reverse = straightEdge("e2", "B", "A");
    const edges = [forward, reverse];
    const nodes = [a, b];

    // Forward edge matches canonical orientation -> side +1 -> shifted to +y.
    expect(getStraightLineGeometry(forward, a, b, edges, nodes)).toEqual({ x1: 0, y1: 0.16, x2: 4, y2: 0.16 });
    // Reverse edge is anti-canonical -> side -1 -> shifted to -y, keeping its own
    // endpoint order (starts at B).
    expect(getStraightLineGeometry(reverse, b, a, edges, nodes)).toEqual({ x1: 4, y1: -0.16, x2: 0, y2: -0.16 });
  });

  it("offsets a vertical corridor along the x axis", () => {
    // A=(0,0), B=(0,4). Canonical A->B (dx=0, dy=4), perpendicular (-1, 0).
    // Forward (canonical) -> offsetX = (-dy/len)*0.16 = -0.16.
    const a = node("A", 0, 0);
    const b = node("B", 0, 4);
    const forward = straightEdge("e1", "A", "B");
    const reverse = straightEdge("e2", "B", "A");
    const edges = [forward, reverse];
    const nodes = [a, b];
    expect(getStraightLineGeometry(forward, a, b, edges, nodes)).toEqual({ x1: -0.16, y1: 0, x2: -0.16, y2: 4 });
    expect(getStraightLineGeometry(reverse, b, a, edges, nodes)).toEqual({ x1: 0.16, y1: 4, x2: 0.16, y2: 0 });
  });
});
