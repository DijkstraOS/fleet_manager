import { describe, expect, it } from "vitest";
import { zoomViewport } from "./geometry";

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
