import { describe, expect, it } from "vitest";
import { wheelZoomScale, zoomViewport } from "./geometry";

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
