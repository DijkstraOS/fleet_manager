import { describe, expect, it } from "vitest";
import {
  ACTION_NODE_RADIUS,
  SUPPORT_NODE_RADIUS,
  nodeRenderRadius,
  snap,
  wheelZoomScale,
  zoomViewport,
} from "./geometry";

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

describe("nodeRenderRadius", () => {
  it("renders action/station nodes at the hefty radius regardless of zoom", () => {
    expect(nodeRenderRadius(true, 3)).toBe(ACTION_NODE_RADIUS);
    expect(nodeRenderRadius(true, 80)).toBe(ACTION_NODE_RADIUS);
  });

  it("keeps support nodes small when zoomed in", () => {
    expect(nodeRenderRadius(false, 3)).toBe(SUPPORT_NODE_RADIUS);
  });

  it("floors support nodes against the viewport so they never vanish when zoomed out", () => {
    const zoomedOut = nodeRenderRadius(false, 80);
    expect(zoomedOut).toBeGreaterThan(SUPPORT_NODE_RADIUS);
    // Grows with the viewport width, keeping a roughly constant on-screen size.
    expect(nodeRenderRadius(false, 80)).toBeGreaterThan(nodeRenderRadius(false, 40));
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

