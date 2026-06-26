import { describe, expect, it } from "vitest";
import {
  ACTION_NODE_RADIUS,
  ARROW_NODE_STANDOFF,
  SUPPORT_NODE_RADIUS,
  arrowStandoffPoint,
  nodeRenderRadius,
  snap,
  wheelZoomScale,
  zoomViewport,
} from "./geometry";

describe("viewport geometry", () => {
  // A floor large enough that this zoom stays within the floor-relative clamp.
  const canvas = { width: 200, height: 100 };

  it("zooms around the provided anchor point", () => {
    const viewport = { x: 0, y: 0, width: 10, height: 5 };

    const next = zoomViewport(viewport, { x: 5, y: 2.5 }, 0.5, canvas);

    expect(next.width).toBe(5);
    expect(next.height).toBe(2.5);
    expect(next.x).toBe(2.5);
    expect(next.y).toBe(1.25);
  });

  it("clamps a zoom-out to the whole floor instead of scrolling into void", () => {
    const viewport = { x: 80, y: 40, width: 40, height: 20 };

    const next = zoomViewport(viewport, { x: 100, y: 50 }, 100, canvas);

    // Capped at the floor width (plus a small breathing margin), centered.
    expect(next.width).toBeGreaterThan(200);
    expect(next.width).toBeLessThan(230);
    expect(next.x).toBeCloseTo((200 - next.width) / 2, 6);
  });
});

describe("nodeRenderRadius", () => {
  it("renders support nodes at the small radius", () => {
    expect(nodeRenderRadius(true)).toBe(SUPPORT_NODE_RADIUS);
  });

  it("renders full nodes at the hefty radius", () => {
    expect(nodeRenderRadius(false)).toBe(ACTION_NODE_RADIUS);
  });

  it("gives full nodes a larger footprint than support nodes", () => {
    expect(nodeRenderRadius(false)).toBeGreaterThan(nodeRenderRadius(true));
  });
});

describe("arrowStandoffPoint", () => {
  it("pulls the endpoint back from the target by the standoff", () => {
    // Edge arriving horizontally from the left at the node (4, 0).
    const point = arrowStandoffPoint({ x: 0, y: 0 }, { x: 4, y: 0 });
    expect(point.x).toBeCloseTo(4 - ARROW_NODE_STANDOFF, 10);
    expect(point.y).toBeCloseTo(0, 10);
  });

  it("keeps the result on the approach->target line for an angled edge", () => {
    const point = arrowStandoffPoint({ x: 0, y: 0 }, { x: 3, y: 4 }); // length 5
    const ratio = (5 - ARROW_NODE_STANDOFF) / 5;
    expect(point.x).toBeCloseTo(3 * ratio, 10);
    expect(point.y).toBeCloseTo(4 * ratio, 10);
  });

  it("leaves the target untouched when the edge is too short to trim", () => {
    const target = { x: ARROW_NODE_STANDOFF / 2, y: 0 };
    expect(arrowStandoffPoint({ x: 0, y: 0 }, target)).toBe(target);
  });
});

describe("snap", () => {
  it("snaps to the nearest 0.1 lattice point", () => {
    expect(snap(0.34)).toBe(0.3);
    expect(snap(0.36)).toBe(0.4);
    expect(snap(1.73)).toBe(1.7);
    expect(snap(1.78)).toBe(1.8);
  });

  it("produces clean increments with no floating-point dust", () => {
    // Use toBe (exact equality), not toBeCloseTo: the whole point of rounding via
    // integers is that 0.3 is literally 0.3, not 0.30000000000000004.
    expect(snap(0.3)).toBe(0.3);
    expect(snap(1.7)).toBe(1.7);
    expect(snap(2.9)).toBe(2.9);
  });

  it("snaps negative coordinates symmetrically", () => {
    expect(snap(-0.34)).toBe(-0.3);
    expect(snap(-0.36)).toBe(-0.4);
    expect(snap(-1.73)).toBe(-1.7);
  });

  it("leaves exact lattice values untouched", () => {
    expect(snap(0)).toBe(0);
    expect(snap(5)).toBe(5);
    expect(snap(-2.5)).toBe(-2.5);
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

